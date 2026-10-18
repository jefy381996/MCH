import { fromText, toUnit, type LucidEvolution } from '@lucid-evolution/lucid';
import { tokenScript } from './blueprint.ts';
import {
  cip68DatumToCbor,
  tokenRedeemer,
  type OutRef,
  type TokenMetadata,
  type TokenSettings,
} from './codec.ts';
import { walletKeyHash } from './oracle-ops.ts';

export interface MintTokenOptions {
  /** Asset name without label, e.g. "MCH". */
  name: string;
  /** Entire supply in base units (whole tokens x 10^decimals). */
  supply: bigint;
  metadata: TokenMetadata;
  /** Where the supply goes. Defaults to the admin wallet. */
  recipient?: string;
  /**
   * The wallet UTxO the mint must consume. It fixes the coin's identity (its
   * policy id), so resending with the same seed can only ever produce the same
   * coin, never a second one. Defaults to the wallet's first UTxO.
   */
  seed?: OutRef;
}

export interface MintedToken {
  settings: TokenSettings;
  policyId: string;
  metadataAddress: string;
  referenceUnit: string;
  fungibleUnit: string;
  txHash: string;
}

/** A signed mint that has not been sent yet. Its txHash is already final. */
export interface PreparedMint extends MintedToken {
  submit(): Promise<string>;
}

/**
 * Builds and signs the mint of the whole, fixed MCH supply, without sending
 * it, so the caller can record it first. Run with the admin wallet selected.
 */
export async function prepareMint(
  lucid: LucidEvolution,
  o: MintTokenOptions,
): Promise<PreparedMint> {
  const network = lucid.config().network;
  if (!network) throw new Error('Lucid has no network configured');
  const admin = await walletKeyHash(lucid);
  const utxos = await lucid.wallet().getUtxos();
  const seed = o.seed
    ? utxos.find((u) => u.txHash === o.seed!.txHash && u.outputIndex === o.seed!.outputIndex)
    : utxos[0];
  if (!seed) {
    throw new Error(
      o.seed
        ? 'the recorded seed UTxO is no longer in the wallet (it has been spent)'
        : 'the admin wallet has no spendable UTxO to use as the mint seed',
    );
  }
  const settings: TokenSettings = {
    admin,
    seed: { txHash: seed.txHash, outputIndex: seed.outputIndex },
    name: o.name,
    supply: o.supply,
  };
  const { script, hash: policyId, address } = tokenScript(settings, network);
  const referenceUnit = toUnit(policyId, fromText(o.name), 100);
  const fungibleUnit = toUnit(policyId, fromText(o.name), 333);
  const recipient = o.recipient ?? (await lucid.wallet().address());

  const tx = lucid
    .newTx()
    .collectFrom([seed])
    .mintAssets({ [referenceUnit]: 1n, [fungibleUnit]: o.supply }, tokenRedeemer.mintSupply())
    .attach.MintingPolicy(script)
    .pay.ToContract(
      address,
      { kind: 'inline', value: cip68DatumToCbor(o.metadata) },
      { [referenceUnit]: 1n },
    )
    .pay.ToAddress(recipient, { [fungibleUnit]: o.supply })
    .addSignerKey(admin);
  const signed = await (await tx.complete()).sign.withWallet().complete();
  return {
    settings,
    policyId,
    metadataAddress: address,
    referenceUnit,
    fungibleUnit,
    txHash: signed.toHash(),
    submit: () => signed.submit(),
  };
}

/** Builds, signs and sends the mint in one go. */
export async function mintToken(lucid: LucidEvolution, o: MintTokenOptions): Promise<MintedToken> {
  const { submit, ...minted } = await prepareMint(lucid, o);
  const sent = await submit();
  return { ...minted, txHash: sent };
}

/**
 * Policy ids of MCH-style coins (CIP-68 fungible, this asset name) already in
 * a set of UTxOs. The deploy script uses this as a second line of defence
 * against minting a second coin when the deployment record has been lost.
 */
export function existingCoins(
  utxos: Array<{ assets: Record<string, bigint> }>,
  name: string,
): string[] {
  const suffix = `0014df10${fromText(name)}`;
  const policies = new Set<string>();
  for (const u of utxos) {
    for (const unit of Object.keys(u.assets)) {
      if (unit.length === 56 + suffix.length && unit.endsWith(suffix))
        policies.add(unit.slice(0, 56));
    }
  }
  return [...policies];
}
