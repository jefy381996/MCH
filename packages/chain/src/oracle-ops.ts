import {
  Data,
  fromText,
  paymentCredentialOf,
  validatorToScriptHash,
  type LucidEvolution,
  type UTxO,
} from '@lucid-evolution/lucid';
import { computeIndexMicro, type Basket } from '@mch/index-core';
import { oracleScript, scriptStore } from './blueprint.ts';
import {
  oracleDatumFromCbor,
  oracleDatumToCbor,
  oracleRedeemer,
  pricesByMetal,
  type OracleDatum,
  type OracleSettings,
  type OutRef,
} from './codec.ts';
import { oracleSettingsOf, requireOracle, type Deployment } from './deployment.ts';

export const AUTH_TOKEN_NAME = 'MCH-ORACLE';
/** ADA kept in the feed UTxO. Covers the ledger's minimum for an output with a datum. */
export const FEED_LOVELACE = 5_000_000n;
export const DEFAULT_MAX_VALIDITY_MS = 10 * 60_000;
/** Validity range used for publications: [now - 1 min, now + 4 min]. */
const VALID_BEFORE_MS = 60_000;
const VALID_AFTER_MS = 4 * 60_000;

export function authUnit(policyId: string): string {
  return policyId + fromText(AUTH_TOKEN_NAME);
}

/** Payment key hash of the wallet currently selected in `lucid`. */
export async function walletKeyHash(lucid: LucidEvolution): Promise<string> {
  const credential = paymentCredentialOf(await lucid.wallet().address());
  if (credential.type !== 'Key')
    throw new Error('the wallet must have a key-based payment address');
  return credential.hash;
}

function networkOf(lucid: LucidEvolution) {
  const network = lucid.config().network;
  if (!network) throw new Error('Lucid has no network configured');
  return network;
}

async function signAndSubmit(tx: ReturnType<LucidEvolution['newTx']>): Promise<string> {
  const unsigned = await tx.complete();
  const signed = await unsigned.sign.withWallet().complete();
  return signed.submit();
}

export interface CreateOracleOptions {
  basket: Basket;
  /** Payment key hash of the hot key that will publish updates. */
  operator: string;
  /** Genesis prices in basket order, micro-USD. */
  pricesMicro: bigint[];
  now: number;
  maxValidityMs?: number;
  /** Also publish the script as a reference script (cheaper updates later). */
  publishReferenceScript?: boolean;
  /** The wallet UTxO to consume; fixes the oracle's identity. Defaults to the first. */
  seed?: OutRef;
}

export interface CreatedOracle {
  settings: OracleSettings;
  policyId: string;
  address: string;
  authUnit: string;
  txHash: string;
  genesis: OracleDatum;
}

/** A signed oracle creation that has not been sent yet. Its txHash is already final. */
export interface PreparedOracle extends CreatedOracle {
  submit(): Promise<string>;
}

/** Builds and signs the oracle creation without sending it. Admin wallet. */
export async function prepareOracle(
  lucid: LucidEvolution,
  o: CreateOracleOptions,
): Promise<PreparedOracle> {
  const network = networkOf(lucid);
  const admin = await walletKeyHash(lucid);
  const utxos = await lucid.wallet().getUtxos();
  const seed = o.seed
    ? utxos.find((u) => u.txHash === o.seed!.txHash && u.outputIndex === o.seed!.outputIndex)
    : utxos[0];
  if (!seed) {
    throw new Error(
      o.seed
        ? 'the recorded seed UTxO is no longer in the wallet (it has been spent)'
        : 'the admin wallet is empty; fund it first',
    );
  }
  const settings: OracleSettings = {
    admin,
    seed: { txHash: seed.txHash, outputIndex: seed.outputIndex },
    basket: o.basket,
    maxValidityMs: o.maxValidityMs ?? DEFAULT_MAX_VALIDITY_MS,
  };
  const { script, hash: policyId, address } = oracleScript(settings, network);
  const unit = authUnit(policyId);
  const genesis: OracleDatum = {
    indexMicro: computeIndexMicro(o.basket, pricesByMetal(o.basket, o.pricesMicro)),
    pricesMicro: o.pricesMicro,
    publishedAt: o.now,
    sequence: 0,
    basketVersion: o.basket.version,
    operator: o.operator,
  };

  let tx = lucid
    .newTx()
    .collectFrom([seed])
    .mintAssets({ [unit]: 1n }, oracleRedeemer.create())
    .attach.MintingPolicy(script)
    .pay.ToContract(
      address,
      { kind: 'inline', value: oracleDatumToCbor(genesis) },
      { lovelace: FEED_LOVELACE, [unit]: 1n },
    )
    .addSignerKey(admin)
    .validFrom(o.now - VALID_BEFORE_MS)
    .validTo(o.now + VALID_AFTER_MS);
  if (o.publishReferenceScript) {
    tx = tx.pay.ToContract(
      scriptStore(network).address,
      { kind: 'inline', value: Data.void() },
      {},
      script,
    );
  }
  const signed = await (await tx.complete()).sign.withWallet().complete();
  return {
    settings,
    policyId,
    address,
    authUnit: unit,
    txHash: signed.toHash(),
    genesis,
    submit: () => signed.submit(),
  };
}

/** Creates the feed: build, sign and send. Run with the admin wallet selected. */
export async function createOracle(
  lucid: LucidEvolution,
  o: CreateOracleOptions,
): Promise<CreatedOracle> {
  const { submit, ...created } = await prepareOracle(lucid, o);
  const sent = await submit();
  return { ...created, txHash: sent };
}

/**
 * Where the oracle's reference script (the script whose hash is the oracle's
 * policy id) was published. Found by its hash, not by transaction, so it is
 * found whichever of several sends of the create transaction landed.
 */
export async function findReferenceScript(
  lucid: LucidEvolution,
  policyId: string,
): Promise<OutRef | undefined> {
  const utxos = await lucid.utxosAt(scriptStore(networkOf(lucid)).address);
  const found = utxos.find((u) => u.scriptRef && validatorToScriptHash(u.scriptRef) === policyId);
  return found && { txHash: found.txHash, outputIndex: found.outputIndex };
}

export interface Feed {
  utxo: UTxO;
  datum: OracleDatum;
}

/** The single UTxO carrying the auth NFT, and its decoded datum. */
export async function readFeed(lucid: LucidEvolution, deployment: Deployment): Promise<Feed> {
  const oracle = requireOracle(deployment);
  const utxos = await lucid.utxosAtWithUnit(oracle.address, oracle.authUnit);
  if (utxos.length !== 1) {
    throw new Error(`expected exactly one oracle UTxO, found ${utxos.length}`);
  }
  const utxo = utxos[0]!;
  if (!utxo.datum) throw new Error('oracle UTxO has no inline datum');
  return { utxo, datum: oracleDatumFromCbor(utxo.datum) };
}

async function withScript(
  lucid: LucidEvolution,
  deployment: Deployment,
  tx: ReturnType<LucidEvolution['newTx']>,
) {
  const ref = requireOracle(deployment).referenceScript;
  if (ref) return tx.readFrom(await lucid.utxosByOutRef([ref]));
  return tx.attach.Script(oracleScript(oracleSettingsOf(deployment), networkOf(lucid)).script);
}

export interface PublishResult {
  txHash: string;
  datum: OracleDatum;
}

/** Publishes new prices. Run with the operator wallet selected. */
export async function publishUpdate(
  lucid: LucidEvolution,
  deployment: Deployment,
  update: { pricesMicro: bigint[]; now: number },
): Promise<PublishResult> {
  const oracle = requireOracle(deployment);
  const basket = oracleSettingsOf(deployment).basket;
  const operator = await walletKeyHash(lucid);
  const { utxo, datum: current } = await readFeed(lucid, deployment);
  if (current.operator !== operator) {
    throw new Error('the selected wallet is not the current oracle operator');
  }
  if (update.now <= current.publishedAt) {
    throw new Error('clock is behind the last publication; refusing to backdate an update');
  }
  const next: OracleDatum = {
    ...current,
    indexMicro: computeIndexMicro(basket, pricesByMetal(basket, update.pricesMicro)),
    pricesMicro: update.pricesMicro,
    publishedAt: update.now,
    sequence: current.sequence + 1,
  };
  const tx = lucid
    .newTx()
    .collectFrom([utxo], oracleRedeemer.update())
    .pay.ToContract(
      oracle.address,
      { kind: 'inline', value: oracleDatumToCbor(next) },
      { lovelace: utxo.assets.lovelace!, [oracle.authUnit]: 1n },
    )
    .addSignerKey(operator)
    .validFrom(update.now - VALID_BEFORE_MS)
    .validTo(update.now + VALID_AFTER_MS);
  return { txHash: await signAndSubmit(await withScript(lucid, deployment, tx)), datum: next };
}

/** Replaces a lost or compromised operator key. Run with the admin wallet selected. */
export async function rotateOperator(
  lucid: LucidEvolution,
  deployment: Deployment,
  newOperator: string,
): Promise<string> {
  const oracle = requireOracle(deployment);
  const admin = await walletKeyHash(lucid);
  const { utxo, datum } = await readFeed(lucid, deployment);
  const tx = lucid
    .newTx()
    .collectFrom([utxo], oracleRedeemer.rotateOperator(newOperator))
    .pay.ToContract(
      oracle.address,
      { kind: 'inline', value: oracleDatumToCbor({ ...datum, operator: newOperator }) },
      { lovelace: utxo.assets.lovelace!, [oracle.authUnit]: 1n },
    )
    .addSignerKey(admin);
  return signAndSubmit(await withScript(lucid, deployment, tx));
}

/** Permanently shuts the feed down and burns the auth NFT. Admin wallet. */
export async function closeOracle(lucid: LucidEvolution, deployment: Deployment): Promise<string> {
  const oracle = requireOracle(deployment);
  const admin = await walletKeyHash(lucid);
  const { utxo } = await readFeed(lucid, deployment);
  const tx = lucid
    .newTx()
    .collectFrom([utxo], oracleRedeemer.close())
    .mintAssets({ [oracle.authUnit]: -1n }, oracleRedeemer.destroy())
    .addSignerKey(admin);
  return signAndSubmit(await withScript(lucid, deployment, tx));
}
