import type { LucidEvolution, UTxO } from '@lucid-evolution/lucid';
import type { Basket } from '@mch/index-core';
import { blueprintHashes } from './blueprint.ts';
import type { OutRef, TokenMetadata } from './codec.ts';
import { basketFileOf, type Deployment, type PartAction } from './deployment.ts';
import { explorerTxUrl, type NetworkName } from './network.ts';
import { findReferenceScript, prepareOracle } from './oracle-ops.ts';
import { existingCoins, prepareMint } from './token-ops.ts';

/**
 * ADA the admin wallet must hold before starting. The coin costs ~2.7 ADA,
 * but building it needs ~6 ADA in one UTxO (outputs carry minimum ADA), so
 * the check asks for the same 10 ADA the guide does.
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
  | { kind: 'cancelled' }
  /** Sent (or possibly sent) and recorded, but not confirmed yet. Re-running finishes the job. */
  | { kind: 'pending'; what: 'coin' | 'oracle'; txHash: string; sendError?: string };

const ada = (lovelace: bigint) => (Number(lovelace) / 1e6).toLocaleString('en-GB');
const firstLine = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).split('\n').find((l) => l.trim()) ??
  'unknown error';
const sameRef = (u: UTxO, r: OutRef) => u.txHash === r.txHash && u.outputIndex === r.outputIndex;

/** Is there an output holding `unit` at `address`? Network errors count as "not yet". */
async function holds(lucid: LucidEvolution, address: string, unit: string): Promise<boolean> {
  try {
    return (await lucid.utxosAtWithUnit(address, unit)).length > 0;
  } catch {
    return false;
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
  const waitFor = async (check: () => Promise<boolean>): Promise<boolean> => {
    const deadline = r.now() + timeoutMs;
    while (!(await check())) {
      if (r.now() >= deadline) return false;
      await r.sleep(intervalMs);
    }
    return true;
  };

  const address = await lucid.wallet().address();
  const utxos = await lucid.wallet().getUtxos();
  let deployment: Deployment = r.existing ?? {
    network: r.network,
    deployedAt: new Date(r.now()).toISOString(),
    blueprint: blueprintHashes(),
  };

  // ---- earlier attempts that were sent but never confirmed ----
  let tokenAction = r.plan.token;
  let tokenSeed: OutRef | undefined;
  if (tokenAction === 'resume') {
    const t = deployment.token!;
    if (await holds(lucid, t.metadataAddress, t.referenceUnit)) {
      deployment = { ...deployment, token: { ...t, status: 'confirmed' } };
      r.save(deployment);
      r.log('✔ The MCH coin from the earlier run is confirmed on the network.');
      tokenAction = 'none';
    } else if (utxos.some((u) => sameRef(u, t.seed))) {
      // The mint spends this UTxO. It is still here, so the earlier attempt never landed.
      r.log('The earlier attempt never reached the network. It can be sent again safely:');
      r.log('the same seed can only ever produce this same coin.');
      tokenAction = 'create';
      tokenSeed = t.seed;
    } else {
      return { kind: 'pending', what: 'coin', txHash: t.mintTx };
    }
  }
  let oracleAction = r.plan.oracle;
  let oracleSeed: OutRef | undefined;
  if (oracleAction === 'resume') {
    const o = deployment.oracle!;
    if (await holds(lucid, o.address, o.authUnit)) {
      const referenceScript =
        o.referenceScript ?? (await findReferenceScript(lucid, o.createTx).catch(() => undefined));
      deployment = { ...deployment, oracle: { ...o, referenceScript, status: 'confirmed' } };
      r.save(deployment);
      r.log('✔ The price oracle from the earlier run is confirmed on the network.');
      oracleAction = 'none';
    } else if (utxos.some((u) => sameRef(u, o.seed))) {
      r.log('The earlier oracle attempt never reached the network. It can be sent again safely.');
      oracleAction = 'create';
      oracleSeed = o.seed;
    } else {
      return { kind: 'pending', what: 'oracle', txHash: o.createTx };
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
      reason: `The admin wallet holds ${ada(lovelace)} ADA; send it at least ${ada(needed)} ADA first.\n  Address: ${address}`,
    };
  }
  if (tokenAction === 'create' && !tokenSeed && !r.allowSecondCoin) {
    const found = existingCoins(utxos, r.coin.assetName);
    if (found.length > 0) {
      return {
        kind: 'refused',
        reason:
          `This wallet already holds an ${r.coin.assetName} coin (policy ${found.join(', ')}).\n` +
          '  Creating another would make a second, different coin. If the record file was lost,\n' +
          '  send me the transaction link from when it was created and I will rebuild the record.',
      };
    }
  }

  // A resend must rebuild exactly the recorded coin: the policy id depends on
  // the seed, asset name and supply, so those come from the record, not .env.
  const recorded = tokenSeed ? deployment.token! : undefined;
  const coin: CoinSpec = recorded
    ? {
        assetName: recorded.name,
        wholeSupply: BigInt(recorded.supply) / 10n ** BigInt(recorded.decimals),
        decimals: recorded.decimals,
        metadata: { ...r.coin.metadata, decimals: recorded.decimals },
      }
    : r.coin;

  if (
    !(await r.confirm(deploySummary({ ...r, coin }, address, lovelace, tokenAction, oracleAction)))
  ) {
    return { kind: 'cancelled' };
  }

  // ---- the coin ----
  if (tokenAction === 'create') {
    const { assetName, decimals, metadata } = coin;
    const supply = recorded ? BigInt(recorded.supply) : coin.wholeSupply * 10n ** BigInt(decimals);
    let prepared;
    try {
      prepared = await prepareMint(lucid, { name: assetName, supply, metadata, seed: tokenSeed });
    } catch (err) {
      return {
        kind: 'refused',
        reason: `Could not build the transaction, so nothing was sent:\n  ${firstLine(err)}`,
      };
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
        mintTx: prepared.txHash,
        status: 'submitted',
      },
    };
    r.save(deployment); // before sending: nothing can reach the chain unrecorded
    r.log('Creating the MCH coin...');
    try {
      await prepared.submit();
    } catch (err) {
      return { kind: 'pending', what: 'coin', txHash: prepared.txHash, sendError: firstLine(err) };
    }
    r.log(`  sent: ${explorerTxUrl(r.network, prepared.txHash)}`);
    r.log('  waiting for the network to confirm it (usually 1-5 minutes)...');
    if (!(await waitFor(() => holds(lucid, prepared.metadataAddress, prepared.referenceUnit)))) {
      return { kind: 'pending', what: 'coin', txHash: prepared.txHash };
    }
    deployment = { ...deployment, token: { ...deployment.token!, status: 'confirmed' } };
    r.save(deployment);
    r.log('  ✔ created, and the record is saved.');
  }

  // ---- the price oracle ----
  if (oracleAction === 'create') {
    let prepared;
    try {
      prepared = await prepareOracle(lucid, {
        basket: r.basket,
        operator: r.operator(),
        pricesMicro: await r.genesisPrices(),
        now: r.now(),
        publishReferenceScript: true,
        seed: oracleSeed,
      });
    } catch (err) {
      return {
        kind: 'refused',
        reason: `Could not build the oracle transaction, so nothing was sent:\n  ${firstLine(err)}`,
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
        basket: basketFileOf(r.basket),
        maxValidityMs: prepared.settings.maxValidityMs,
        createTx: prepared.txHash,
        status: 'submitted',
      },
    };
    r.save(deployment);
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
    if (!(await waitFor(() => holds(lucid, prepared.address, prepared.authUnit)))) {
      return { kind: 'pending', what: 'oracle', txHash: prepared.txHash };
    }
    const referenceScript = await findReferenceScript(lucid, prepared.txHash).catch(
      () => undefined,
    );
    deployment = {
      ...deployment,
      oracle: { ...deployment.oracle!, referenceScript, status: 'confirmed' },
    };
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
      '  Create the MCH coin',
      `    Name         ${m.name} (ticker ${m.ticker}, asset name ${assetName})`,
      `    Total supply ${wholeSupply.toLocaleString('en-GB')} coins, ${decimals} decimal places`,
      `    Description  ${m.description}`,
      `    Logo         ${m.logo ?? '(none; can be added later)'}`,
      '    Cost         about 2.7 ADA',
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
