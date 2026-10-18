import type { LucidEvolution } from '@lucid-evolution/lucid';
import type { Basket } from '@mch/index-core';
import { blueprintHashes } from './blueprint.ts';
import type { TokenMetadata } from './codec.ts';
import { basketFileOf, type Deployment } from './deployment.ts';
import { explorerTxUrl, type NetworkName } from './network.ts';
import { createOracle, findReferenceScript, readFeed } from './oracle-ops.ts';
import { existingCoins, mintToken } from './token-ops.ts';

/** ADA the admin wallet must hold before starting, with headroom over the real cost. */
export const COIN_BUDGET_LOVELACE = 5_000_000n; // actual cost ~2.7 ADA
export const ORACLE_BUDGET_LOVELACE = 30_000_000n; // actual cost ~20 ADA

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
  plan: { mintToken: boolean; createOracle: boolean };
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
}

export type DeployOutcome =
  | { kind: 'done'; deployment: Deployment }
  | { kind: 'refused'; reason: string }
  | { kind: 'cancelled' };

const ada = (lovelace: bigint) => (Number(lovelace) / 1e6).toLocaleString('en-GB');

/**
 * Everything after connecting: wallet checks, the summary and confirmation,
 * then the transactions, saving the record after each one. Kept out of the
 * CLI so the path that spends real ADA is covered by emulator tests.
 */
export async function runDeploy(r: DeployRun): Promise<DeployOutcome> {
  const address = await r.lucid.wallet().address();
  const utxos = await r.lucid.wallet().getUtxos();
  const lovelace = utxos.reduce((sum, u) => sum + (u.assets.lovelace ?? 0n), 0n);
  const needed =
    (r.plan.mintToken ? COIN_BUDGET_LOVELACE : 0n) +
    (r.plan.createOracle ? ORACLE_BUDGET_LOVELACE : 0n);
  if (lovelace < needed) {
    return {
      kind: 'refused',
      reason: `The admin wallet holds ${ada(lovelace)} ADA; send it at least ${ada(needed)} ADA first.\n  Address: ${address}`,
    };
  }
  if (r.plan.mintToken && !r.allowSecondCoin) {
    const found = existingCoins(utxos, r.coin.assetName);
    if (found.length > 0) {
      return {
        kind: 'refused',
        reason:
          `This wallet already holds an ${r.coin.assetName} coin (policy ${found.join(', ')}).\n` +
          '  Creating another would make a second, different coin. If you lost the deployment record,\n' +
          '  recover it rather than minting again. Only if you truly want a second coin, add --allow-second-coin.',
      };
    }
  }

  if (!(await r.confirm(deploySummary(r, address, lovelace)))) return { kind: 'cancelled' };

  let deployment: Deployment = r.existing ?? {
    network: r.network,
    deployedAt: new Date(r.now()).toISOString(),
    blueprint: blueprintHashes(),
  };

  if (r.plan.mintToken) {
    const { assetName, wholeSupply, decimals, metadata } = r.coin;
    const supply = wholeSupply * 10n ** BigInt(decimals);
    r.log('Creating the MCH coin...');
    const token = await mintToken(r.lucid, { name: assetName, supply, metadata });
    r.log(`  submitted: ${explorerTxUrl(r.network, token.txHash)}`);
    r.log('  waiting for the network to confirm it (usually under a minute)...');
    await r.lucid.awaitTx(token.txHash);
    deployment = {
      ...deployment,
      token: {
        policyId: token.policyId,
        name: assetName,
        referenceUnit: token.referenceUnit,
        fungibleUnit: token.fungibleUnit,
        supply: supply.toString(),
        decimals,
        admin: token.settings.admin,
        seed: token.settings.seed,
        metadataAddress: token.metadataAddress,
        mintTx: token.txHash,
      },
    };
    r.save(deployment);
    r.log('  ✔ created, and the record is saved.');
  }

  if (r.plan.createOracle) {
    r.log('Creating the price oracle...');
    const oracle = await createOracle(r.lucid, {
      basket: r.basket,
      operator: r.operator(),
      pricesMicro: await r.genesisPrices(),
      now: r.now(),
      publishReferenceScript: true,
    });
    r.log(`  submitted: ${explorerTxUrl(r.network, oracle.txHash)}`);
    await r.lucid.awaitTx(oracle.txHash);
    deployment = {
      ...deployment,
      oracle: {
        policyId: oracle.policyId,
        address: oracle.address,
        authUnit: oracle.authUnit,
        admin: oracle.settings.admin,
        seed: oracle.settings.seed,
        basket: basketFileOf(r.basket),
        maxValidityMs: oracle.settings.maxValidityMs,
        referenceScript: await findReferenceScript(r.lucid, oracle.txHash),
        createTx: oracle.txHash,
      },
    };
    r.save(deployment);
    const { datum } = await readFeed(r.lucid, deployment);
    r.log(
      `  ✔ created, index on-chain ${Number(datum.indexMicro) / 1e6}, and the record is saved.`,
    );
  }

  return { kind: 'done', deployment };
}

/** What is about to happen, in plain words. Shown before anything is sent. */
export function deploySummary(r: DeployRun, address: string, lovelace: bigint): string {
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
  if (r.plan.mintToken) {
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
  if (r.plan.createOracle) {
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
