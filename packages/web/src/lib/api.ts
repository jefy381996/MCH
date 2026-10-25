import type { BasketFile, FeedStatus, IndexSnapshotDTO, MetalId, MetalInfo } from '@mch/index-core';

export type Range = '1d' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface IndexPayload {
  snapshot: IndexSnapshotDTO | null;
  status: FeedStatus | 'waiting';
  componentStatus: Partial<Record<MetalId, FeedStatus>>;
  change24hPct: number | null;
  dataSource: { id: string; label: string; isDemo: boolean };
  serverTime: string;
}

export interface HistoryPayload {
  range: Range;
  from: string;
  to: string;
  points: Array<{ t: string; index: string; prices: Partial<Record<MetalId, string>> }>;
}

export interface BasketPayload {
  basket: BasketFile;
  metals: MetalInfo[];
  methodology: { formula: string; precision: string };
}

export interface TokenInfo {
  policyId: string;
  unit: string;
  name: string;
  decimals: number;
  supply: string;
  explorerUrl: string;
}

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

/** The chain as served by /api/oracle: the coin, and the oracle feed once it exists. */
export interface OraclePayload {
  configured: boolean;
  network: string | null;
  token: TokenInfo | null;
  oracleDeployed: boolean;
  status: OracleStatus | null;
  error?: string;
}

/** Who runs the site, when configured on the server. */
export interface SitePayload {
  operator: string | null;
  contactEmail: string | null;
}

export async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}
