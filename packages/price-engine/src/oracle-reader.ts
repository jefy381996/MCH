/**
 * What the website shows about the on-chain feed. Implemented in @mch/chain;
 * kept as an interface here so the backend runs fine with no chain at all.
 */
export interface OracleStatus {
  network: string;
  policyId: string;
  scriptAddress: string;
  /** Index as published on-chain, decimal string. */
  index: string;
  /** Prices as published, decimal strings keyed by metal, in basket order. */
  prices: Record<string, string>;
  publishedAt: string;
  sequence: number;
  basketVersion: number;
  /** Transaction that produced the current state. */
  txHash: string;
  explorerUrl: string;
}

export interface OracleReader {
  read(): Promise<OracleStatus | null>;
}
