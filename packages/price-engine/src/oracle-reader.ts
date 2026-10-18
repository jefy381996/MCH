import type { OracleStatus, TokenInfo } from '@mch/chain';

export type { OracleStatus, TokenInfo } from '@mch/chain';

/**
 * What the website shows about the chain: the coin's details (from the
 * deployment record) and the live oracle feed (null until one exists).
 * Implemented in @mch/chain and loaded only when a deployment is configured,
 * so the backend runs fine, and starts fast, with no chain at all.
 */
export interface OracleReader {
  network: string;
  token: TokenInfo | null;
  hasOracle: boolean;
  read(): Promise<OracleStatus | null>;
}
