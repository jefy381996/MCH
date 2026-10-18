import type { Provider } from '@lucid-evolution/lucid';
import { formatMicro, parseBasket } from '@mch/index-core';
import { oracleDatumFromCbor } from './codec.ts';
import type { Deployment } from './deployment.ts';
import { explorerTokenUrl, explorerTxUrl } from './network.ts';

export interface TokenInfo {
  policyId: string;
  unit: string;
  name: string;
  decimals: number;
  supply: string;
  explorerUrl: string;
}

/** The on-chain feed, as served by the backend at /api/oracle. */
export interface OracleStatus {
  network: string;
  policyId: string;
  scriptAddress: string;
  index: string;
  prices: Record<string, string>;
  publishedAt: string;
  sequence: number;
  basketVersion: number;
  txHash: string;
  explorerUrl: string;
}

/**
 * Read-only view of a deployment. Needs no keys, so it is safe in the web
 * server. The coin's details come from the deployment record; the feed is
 * read live from the chain, and is null until an oracle has been created.
 */
export function createOracleReader(deployment: Deployment, provider: Provider) {
  const token: TokenInfo | null = deployment.token
    ? {
        policyId: deployment.token.policyId,
        unit: deployment.token.fungibleUnit,
        name: deployment.token.name,
        decimals: deployment.token.decimals,
        supply: deployment.token.supply,
        explorerUrl: explorerTokenUrl(deployment.network, deployment.token.fungibleUnit),
      }
    : null;
  const oracle = deployment.oracle;
  const basket = oracle ? parseBasket(oracle.basket) : null;
  return {
    network: deployment.network,
    token,
    hasOracle: !!oracle,
    async read(): Promise<OracleStatus | null> {
      if (!oracle || !basket) return null;
      const utxos = await provider.getUtxosWithUnit(oracle.address, oracle.authUnit);
      const utxo = utxos[0];
      if (!utxo?.datum) return null;
      const datum = oracleDatumFromCbor(utxo.datum);
      return {
        network: deployment.network,
        policyId: oracle.policyId,
        scriptAddress: oracle.address,
        index: formatMicro(datum.indexMicro),
        prices: Object.fromEntries(
          basket.components.map((c, i) => [c.metal, formatMicro(datum.pricesMicro[i] ?? 0n)]),
        ),
        publishedAt: new Date(datum.publishedAt).toISOString(),
        sequence: datum.sequence,
        basketVersion: datum.basketVersion,
        txHash: utxo.txHash,
        explorerUrl: explorerTxUrl(deployment.network, utxo.txHash),
      };
    },
  };
}
