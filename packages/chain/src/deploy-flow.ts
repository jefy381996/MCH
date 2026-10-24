import type { LucidEvolution, UTxO } from '@lucid-evolution/lucid';
import { parseBasket, type Basket, type BasketFile } from '@mch/index-core';
import { blueprintHashes } from './blueprint.ts';
import type { OutRef, TokenMetadata } from './codec.ts';
import {
  basketFileOf,
  type Deployment,
  type OracleDeployment,
  type PartAction,
  type TokenDeployment,
} from './deployment.ts';
import { explorerTxUrl, type NetworkName } from './network.ts';
import { findReferenceScript, prepareOracle, walletKeyHash } from './oracle-ops.ts';
import { cip68Coins, prepareMint } from './token-ops.ts';

/**
 * ADA the admin wallet must hold before starting. The coin costs ~2.1 ADA
 * (pinned in fees.test.ts), but building it needs ~6 ADA in one UTxO
 * (outputs carry minimum ADA), so the check asks for the same 10 ADA the
 * guide does.
 */
export const COIN_BUDGET_LOVELACE = 10_000_000n;
/** The oracle costs ~20 ADA, most of it locked with the feed and its script. */
export const ORACLE_BUDGET_LOVELACE = 30_000_000n;

export interface CoinSpec {
  /** Permanent asset name, e.g. "MCH". */
  assetName: string;
  /** Whole coins, before decimals. Permanent. */
  wholeSupply: bigint;
  decimals: number;
  metadata: TokenMetadata;
}

export interface DeployRun {
  lucid: LucidEvolution;
  network: NetworkName | 'Custom';
  existing: Deployment | null;
  plan: { token: PartAction; oracle: PartAction };
  coin: CoinSpec;
  basket: Basket;
  allowSecondCoin: boolean;
  /** Shows the summary; resolves true to go ahead. Nothing is sent before this. */
  confirm(summary: string): Promise<boolean>;
  /** Operator key hash; only called when the oracle is being created. */
  operator(): string;
  /** Opening prices for the oracle; only called when the oracle is being created. */
  genesisPrices(): Promise<bigint[]>;
  save(deployment: Deployment): void;
  log(line: string): void;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** How long to wait for the network to confirm, before reporting "pending". */
  confirmTimeoutMs?: number;
  pollIntervalMs?: number;
  /** Override for tests; defaults to COIN_BUDGET_LOVELACE. */
  coinBudgetLovelace?: bigint;
}

export type DeployOutcome =
  | { kind: 'done'; deployment: Deployment }
  | { kind: 'refused'; reason: string }
  /** `earlier`: an earlier attempt was not resent, and may still land. */
  | { kind: 'cancelled'; earlier?: boolean }
  /**
   * Sent (or possibly sent) and recorded, but not confirmed yet. Re-running
   * finishes the job. `resent`: this run sent a new copy of an earlier
   * attempt, which may itself still be on its way.
   */
  | {
      kind: 'pending';
      what: 'coin' | 'oracle';
      txHash: string;
      sendError?: string;
      resent?: boolean;
    };

const ada = (lovelace: bigint) => (Number(lovelace) / 1e6).toLocaleString('en-GB');
const firstLine = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).split('\n').find((l) => l.trim()) ??
  'unknown error';
const sameRef = (u: UTxO, r: OutRef) => u.txHash === r.txHash && u.outputIndex === r.outputIndex;
const sameBasket = (recorded: BasketFile, current: Basket) =>
  JSON.stringify(basketFileOf(parseBasket(recorded))) === JSON.stringify(basketFileOf(current));
const walletUnreadable = (err: unknown) =>
  `Could not read the admin wallet from the network, so nothing was sent:\n  ${firstLine(err)}\n` +
  '  Try again in a few minutes.';
const unsaved = (err: unknown) =>
  `Could not save the record file, so nothing was sent:\n  ${firstLine(err)}\n` +
  '  Close any program that has the record file open, then run this again.';
/** Refuses if the wallet already holds a coin of this kind: making another would be a second coin. */
function secondCoin(utxos: UTxO[]): DeployOutcome | undefined {
  const found = cip68Coins(utxos);
  if (found.length === 0) return undefined;
  return {
    kind: 'refused',
    reason:
      `This wallet already holds a coin: ${found.map((c) => `${c.name} (policy ${c.policyId})`).join(', ')}.\n` +
      '  Creating another would make a second, different coin, so nothing was sent. If the record\n' +
      '  file was lost or is out of date, send me the transaction link from when that coin was\n' +
      '  created and I will rebuild the record. If you have never created a coin with this wallet,\n' +
      '  someone may have sent you this one: send me this message.',
  };
}
const mismatch = (what: string, got: string, want: string) =>
  `Rebuilding the earlier ${what} gave policy ${got}, but the record says ${want}, so nothing\n` +
  '  was sent. Is secrets/admin.seed still the wallet it was first sent from?';

/** The first output holding `unit` at `address`. Network errors count as "not there yet". */
async function findUnit(
  lucid: LucidEvolution,
  address: string,
  unit: string,
): Promise<UTxO | undefined> {
  try {
    return (await lucid.utxosAtWithUnit(address, unit))[0];
  } catch {
    return undefined;
  }
}

/**
 * Everything after connecting: wallet checks, the summary and confirmation,
 * then the transactions. The record is saved after each transaction is
 * signed and before it is sent, so nothing that reaches the chain can go
 * unrecorded; confirmation is then awaited patiently, tolerating provider
 * hiccups. Kept out of the CLI so this path is covered by emulator tests.
 */
export async function runDeploy(r: DeployRun): Promise<DeployOutcome> {
  const lucid = r.lucid;
  const timeoutMs = r.confirmTimeoutMs ?? 10 * 60_000;
  const intervalMs = r.pollIntervalMs ?? 15_000;
  const waitFor = async <T>(look: () => Promise<T | undefined>): Promise<T | undefined> => {
    const deadline = r.now() + timeoutMs;
    for (;;) {
      const found = await look();
      if (found !== undefined || r.now() >= deadline) return found;
      await r.sleep(intervalMs);
    }
  };
  // Published by the same transaction as the oracle feed, so it should be
  // readable at once; a few tries ride out a busy provider.
  const referenceScriptOf = async (policyId: string): Promise<OutRef | undefined> => {
    for (let tries = 0; tries < 3; tries++) {
      if (tries > 0) await r.sleep(intervalMs);
      const found = await findReferenceScript(lucid, policyId).catch(() => undefined);
      if (found) return found;
    }
    r.log("  (Could not read the oracle's reference script yet. The oracle works without it;");
    r.log('  run this command again later to add it to the record: price updates then cost less.)');
    return undefined;
  };
  // Confirmed records name the transaction that actually landed. A resend made
  // while the first send was still waiting differs from it in its bytes (never
  // in what it creates), and only one of the two can land.
  const confirmedCoin = (t: TokenDeployment, reference: UTxO): TokenDeployment => ({
    ...t,
    mintTx: reference.txHash,
    status: 'confirmed',
  });
  const confirmedOracle = async (o: OracleDeployment, feed: UTxO): Promise<OracleDeployment> => {
    const referenceScript = await referenceScriptOf(o.policyId);
    // The reference script never moves; the feed moves with every price update.
    const createTx = referenceScript?.txHash ?? feed.txHash;
    return { ...o, createTx, referenceScript, status: 'confirmed' };
  };

  /** Does the wallet still hold this UTxO? If the wallet cannot be read, assume not. */
  const stillHolds = async (ref: OutRef): Promise<boolean> =>
    (
      await lucid
        .wallet()
        .getUtxos()
        .catch(() => [] as UTxO[])
    ).some((u) => sameRef(u, ref));

  let address: string;
  let adminKey: string;
  let utxos: UTxO[];
  try {
    address = await lucid.wallet().address();
    adminKey = await walletKeyHash(lucid);
    utxos = await lucid.wallet().getUtxos();
  } catch (err) {
    return { kind: 'refused', reason: walletUnreadable(err) };
  }
  let deployment: Deployment = r.existing ?? {
    network: r.network,
    deployedAt: new Date(r.now()).toISOString(),
    blueprint: blueprintHashes(),
  };
  // Finishing an earlier attempt needs the wallet that signed it.
  const unfinished = [deployment.token, deployment.oracle].filter((p) => p?.status === 'submitted');
  if (unfinished.some((p) => p!.admin !== adminKey)) {
    return {
      kind: 'refused',
      reason:
        'The record was made with a different admin wallet from the one in secrets/admin.seed,\n' +
        '  so nothing was sent. Put back the admin.seed the earlier attempt used (the 24 words\n' +
        '  on your paper), or ask me.',
    };
  }

  // ---- earlier attempts that were sent but never confirmed ----
  let tokenAction = r.plan.token;
  let tokenSeed: OutRef | undefined;
  if (tokenAction === 'resume') {
    const t = deployment.token!;
    const reference = await findUnit(lucid, t.metadataAddress, t.referenceUnit);
    if (reference) {
      deployment = { ...deployment, token: confirmedCoin(t, reference) };
      r.save(deployment);
      r.log('✔ The MCH coin from the earlier run is confirmed on the network.');
      tokenAction = 'none';
    } else if (utxos.some((u) => sameRef(u, t.seed))) {
      // The mint spends this UTxO and the network still shows it, so the earlier
      // attempt has not landed (it may still be on its way).
      r.log('The network does not show the earlier attempt yet, so it will be sent again.');
      r.log('This is safe: it can only ever make this same coin, and only once.');
      tokenAction = 'create';
      tokenSeed = t.seed;
    } else {
      return { kind: 'pending', what: 'coin', txHash: t.mintTx };
    }
  }
  let oracleAction = r.plan.oracle;
  let oracleResend: OracleDeployment | undefined;
  if (oracleAction === 'resume') {
    const o = deployment.oracle!;
    if (o.status !== 'submitted') {
      // Confirmed before, but its reference script could not be read then.
      const referenceScript = await referenceScriptOf(o.policyId);
      if (referenceScript) {
        const oracle = { ...o, referenceScript, createTx: referenceScript.txHash };
        deployment = { ...deployment, oracle };
        r.save(deployment);
        r.log("✔ Found the price oracle's reference script and added it to the record.");
      }
      oracleAction = 'none';
    } else {
      const feed = await findUnit(lucid, o.address, o.authUnit);
      if (feed) {
        deployment = { ...deployment, oracle: await confirmedOracle(o, feed) };
        r.save(deployment);
        r.log('✔ The price oracle from the earlier run is confirmed on the network.');
        oracleAction = 'none';
      } else if (utxos.some((u) => sameRef(u, o.seed))) {
        if (!sameBasket(o.basket, r.basket)) {
          return {
            kind: 'refused',
            reason:
              'The network does not show the earlier oracle attempt yet, and the basket file has\n' +
              `  changed since (the attempt used "${o.basket.name}" v${o.basket.version}). Sending it again needs the basket\n` +
              '  it was made with, so nothing was sent. Put the basket file back, or wait: it may still land.',
          };
        }
        r.log(
          'The network does not show the earlier oracle attempt yet, so it will be sent again.',
        );
        oracleAction = 'create';
        oracleResend = o;
      } else {
        return { kind: 'pending', what: 'oracle', txHash: o.createTx };
      }
    }
  }
  if (tokenAction === 'none' && oracleAction === 'none') return { kind: 'done', deployment };

  // ---- checks before asking ----
  const lovelace = utxos.reduce((sum, u) => sum + (u.assets.lovelace ?? 0n), 0n);
  const needed =
    (tokenAction === 'create' ? (r.coinBudgetLovelace ?? COIN_BUDGET_LOVELACE) : 0n) +
    (oracleAction === 'create' ? ORACLE_BUDGET_LOVELACE : 0n);
  if (lovelace < needed) {
    return {
      kind: 'refused',
      reason:
        `The admin wallet holds ${ada(lovelace)} ADA but needs at least ${ada(needed)} ADA, so nothing was sent.\n` +
        `  Send at least ${ada(needed - lovelace)} more ADA to the admin address:\n  ${address}`,
    };
  }
  // Also on a resend: the recorded attempt has not landed, so any coin already
  // here is a different one, made by a run whose record was lost.
  if (tokenAction === 'create' && !r.allowSecondCoin) {
    const refusal = secondCoin(utxos);
    if (refusal) return refusal;
  }
  // Everything the oracle needs from outside, before anything is sent.
  let oracleInputs: { operator: string; prices: bigint[] } | undefined;
  if (oracleAction === 'create') {
    try {
      oracleInputs = { operator: r.operator(), prices: await r.genesisPrices() };
    } catch (err) {
      return {
        kind: 'refused',
        reason: `Could not prepare the price oracle, so nothing was sent:\n  ${firstLine(err)}`,
      };
    }
  }

  // A resend must rebuild exactly the recorded coin: the policy id depends on
  // the seed, asset name and supply, so those come from the record, not .env.
  // So does its text, so that what the summary shows is what lands, whichever
  // copy lands.
  const recorded = tokenSeed ? deployment.token! : undefined;
  const coin: CoinSpec = recorded
    ? {
        assetName: recorded.name,
        wholeSupply: BigInt(recorded.supply) / 10n ** BigInt(recorded.decimals),
        decimals: recorded.decimals,
        metadata: recorded.metadata ?? { ...r.coin.metadata, decimals: recorded.decimals },
      }
    : r.coin;
  if (recorded?.metadata && JSON.stringify(recorded.metadata) !== JSON.stringify(r.coin.metadata)) {
    r.log('It keeps the name and description of the earlier attempt; changes in .env can be');
    r.log('made after the coin exists, with the update command.');
  }

  if (
    !(await r.confirm(deploySummary({ ...r, coin }, address, lovelace, tokenAction, oracleAction)))
  ) {
    return { kind: 'cancelled', earlier: Boolean(recorded || oracleResend) };
  }

  // ---- look again: the reader may have taken a while to answer. An earlier
  // attempt may have landed meanwhile, or another computer made a coin. ----
  if (tokenAction === 'create') {
    let latest: UTxO[];
    try {
      latest = await lucid.wallet().getUtxos();
    } catch (err) {
      return { kind: 'refused', reason: walletUnreadable(err) };
    }
    if (recorded) {
      const reference = await findUnit(lucid, recorded.metadataAddress, recorded.referenceUnit);
      if (reference) {
        deployment = { ...deployment, token: confirmedCoin(recorded, reference) };
        r.save(deployment);
        r.log('✔ The MCH coin from the earlier run is confirmed on the network.');
        tokenAction = 'none';
      } else if (!latest.some((u) => sameRef(u, recorded.seed))) {
        return { kind: 'pending', what: 'coin', txHash: recorded.mintTx };
      }
    }
    if (tokenAction === 'create' && !r.allowSecondCoin) {
      const refusal = secondCoin(latest);
      if (refusal) return refusal;
    }
  }

  // ---- the coin ----
  if (tokenAction === 'create') {
    const { assetName, decimals, metadata } = coin;
    const supply = recorded ? BigInt(recorded.supply) : coin.wholeSupply * 10n ** BigInt(decimals);
    const earlierTx = recorded?.mintTx;
    let prepared;
    try {
      prepared = await prepareMint(lucid, { name: assetName, supply, metadata, seed: tokenSeed });
    } catch (err) {
      // On a resend the usual cause is that the earlier attempt spent the seed
      // (it landed while the reader was answering): never say nothing happened.
      if (earlierTx && !(await stillHolds(recorded!.seed))) {
        return { kind: 'pending', what: 'coin', txHash: earlierTx };
      }
      return {
        kind: 'refused',
        reason:
          `Could not build the transaction, so nothing ${earlierTx ? 'new ' : ''}was sent:\n  ${firstLine(err)}\n` +
          '  Try again in a few minutes. If it happens again, send me this message.',
      };
    }
    if (recorded && prepared.policyId !== recorded.policyId) {
      return { kind: 'refused', reason: mismatch('coin', prepared.policyId, recorded.policyId) };
    }
    deployment = {
      ...deployment,
      token: {
        policyId: prepared.policyId,
        name: assetName,
        referenceUnit: prepared.referenceUnit,
        fungibleUnit: prepared.fungibleUnit,
        supply: supply.toString(),
        decimals,
        admin: prepared.settings.admin,
        seed: prepared.settings.seed,
        metadataAddress: prepared.metadataAddress,
        metadata,
        mintTx: prepared.txHash,
        status: 'submitted',
      },
    };
    try {
      r.save(deployment); // before sending: nothing can reach the chain unrecorded
    } catch (err) {
      return { kind: 'refused', reason: unsaved(err) };
    }
    r.log(`Creating the ${assetName} coin...`);
    try {
      await prepared.submit();
    } catch (err) {
      const sendError = firstLine(err);
      // A resend is often refused because the first copy is still on its way.
      if (earlierTx)
        return { kind: 'pending', what: 'coin', txHash: earlierTx, sendError, resent: true };
      return { kind: 'pending', what: 'coin', txHash: prepared.txHash, sendError };
    }
    r.log(`  sent: ${explorerTxUrl(r.network, prepared.txHash)}`);
    r.log('  waiting for the network to confirm it (usually 1-5 minutes)...');
    const reference = await waitFor(() =>
      findUnit(lucid, prepared.metadataAddress, prepared.referenceUnit),
    );
    if (!reference) return { kind: 'pending', what: 'coin', txHash: prepared.txHash };
    deployment = { ...deployment, token: confirmedCoin(deployment.token!, reference) };
    r.save(deployment);
    r.log('  ✔ created, and the record is saved.');
  }

  // ---- the price oracle ----
  if (oracleAction === 'create') {
    // As for the coin: a resend rebuilds the recorded oracle, whose policy id
    // depends on its basket and validity window as well as the seed.
    const basket = oracleResend ? parseBasket(oracleResend.basket) : r.basket;
    let prepared;
    try {
      prepared = await prepareOracle(lucid, {
        basket,
        operator: oracleInputs!.operator,
        // Fetched again: the reader may have spent a while at the prompt, and the
        // opening prices are stamped with the time the transaction is built.
        pricesMicro: await r.genesisPrices(),
        now: r.now(),
        publishReferenceScript: true,
        seed: oracleResend?.seed,
        maxValidityMs: oracleResend?.maxValidityMs,
      });
    } catch (err) {
      if (oracleResend && !(await stillHolds(oracleResend.seed))) {
        return { kind: 'pending', what: 'oracle', txHash: oracleResend.createTx };
      }
      return {
        kind: 'refused',
        reason: `Could not build the oracle transaction, so nothing ${oracleResend ? 'new ' : ''}was sent:\n  ${firstLine(err)}`,
      };
    }
    if (oracleResend && prepared.policyId !== oracleResend.policyId) {
      return {
        kind: 'refused',
        reason: mismatch('oracle', prepared.policyId, oracleResend.policyId),
      };
    }
    deployment = {
      ...deployment,
      oracle: {
        policyId: prepared.policyId,
        address: prepared.address,
        authUnit: prepared.authUnit,
        admin: prepared.settings.admin,
        seed: prepared.settings.seed,
        basket: basketFileOf(basket),
        maxValidityMs: prepared.settings.maxValidityMs,
        createTx: prepared.txHash,
        status: 'submitted',
      },
    };
    try {
      r.save(deployment);
    } catch (err) {
      return { kind: 'refused', reason: unsaved(err) };
    }
    r.log('Creating the price oracle...');
    try {
      await prepared.submit();
    } catch (err) {
      return {
        kind: 'pending',
        what: 'oracle',
        txHash: prepared.txHash,
        sendError: firstLine(err),
      };
    }
    r.log(`  sent: ${explorerTxUrl(r.network, prepared.txHash)}`);
    const feed = await waitFor(() => findUnit(lucid, prepared.address, prepared.authUnit));
    if (!feed) return { kind: 'pending', what: 'oracle', txHash: prepared.txHash };
    deployment = { ...deployment, oracle: await confirmedOracle(deployment.oracle!, feed) };
    r.save(deployment);
    r.log('  ✔ created, and the record is saved.');
  }

  return { kind: 'done', deployment };
}

/** What is about to happen, in plain words. Shown before anything is sent. */
export function deploySummary(
  r: DeployRun,
  address: string,
  lovelace: bigint,
  token: PartAction = r.plan.token,
  oracle: PartAction = r.plan.oracle,
): string {
  const line = '─'.repeat(64);
  const out = [
    line,
    r.network === 'Mainnet'
      ? '  REAL CARDANO (Mainnet): this uses real ADA'
      : `  Cardano ${r.network} (test network)`,
    line,
    `  Admin wallet   ${address}`,
    `  Balance        ${ada(lovelace)} ADA`,
  ];
  if (token === 'create') {
    const { metadata: m, wholeSupply, decimals, assetName } = r.coin;
    out.push(
      '',
      `  Create the ${assetName} coin`,
      `    Asset name   ${assetName}   (permanent: the coin's identity on Cardano)`,
      `    Name         ${m.name} (ticker ${m.ticker})`,
      `    Total supply ${wholeSupply.toLocaleString('en-GB')} coins, ${decimals} decimal places`,
      `    Description  ${m.description}`,
      `    Logo         ${m.logo ?? '(none; can be added later)'}`,
      '    Cost         about 2 ADA (a little more with a long description or a logo)',
      '    PERMANENT    the supply and asset name can never be changed, and no more coins',
      '                 can ever be created. Name, description and logo can be updated later.',
    );
  }
  if (oracle === 'create') {
    out.push(
      '',
      '  Create the price oracle',
      `    Basket       ${r.basket.name} v${r.basket.version}${r.basket.isDemo ? ' (DEMO base prices)' : ''}`,
      '    Cost         about 20 ADA (about 19 stays locked with the oracle)',
    );
  }
  out.push(line);
  return out.join('\n');
}
