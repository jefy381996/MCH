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

/** Shape served by the backend at /api/oracle. */
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
  token: TokenInfo | null;
}

/** Read-only view of the feed. Needs no keys, so it is safe in the web server. */
export function createOracleReader(deployment: Deployment, provider: Provider) {
  const basket = parseBasket(deployment.oracle.basket);
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
  return {
    async read(): Promise<OracleStatus | null> {
      const utxos = await provider.getUtxosWithUnit(
        deployment.oracle.address,
        deployment.oracle.authUnit,
      );
      const utxo = utxos[0];
      if (!utxo?.datum) return null;
      const datum = oracleDatumFromCbor(utxo.datum);
      return {
        network: deployment.network,
        policyId: deployment.oracle.policyId,
        scriptAddress: deployment.oracle.address,
        index: formatMicro(datum.indexMicro),
        prices: Object.fromEntries(
          basket.components.map((c, i) => [c.metal, formatMicro(datum.pricesMicro[i] ?? 0n)]),
        ),
        publishedAt: new Date(datum.publishedAt).toISOString(),
        sequence: datum.sequence,
        basketVersion: datum.basketVersion,
        txHash: utxo.txHash,
        explorerUrl: explorerTxUrl(deployment.network, utxo.txHash),
        token,
      };
    },
  };
}
