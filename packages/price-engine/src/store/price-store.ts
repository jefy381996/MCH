import type { IndexSnapshot, MetalId, PriceQuote } from '@mch/index-core';

export interface HistoryPoint {
  at: Date;
  indexMicro: bigint;
}

/**
 * Where quotes and index snapshots live. Two implementations: Postgres for
 * anything real, memory for trying the project out with zero setup.
 */
export interface PriceStore {
  readonly kind: 'postgres' | 'memory';
  init(): Promise<void>;
  close(): Promise<void>;
  isEmpty(): Promise<boolean>;
  saveQuotes(quotes: PriceQuote[]): Promise<void>;
  saveSnapshots(snapshots: IndexSnapshot[]): Promise<void>;
  latestQuotes(): Promise<Partial<Record<MetalId, PriceQuote>>>;
  latestSnapshot(): Promise<IndexSnapshot | null>;
  /** The newest snapshot at or before `at`, e.g. for a 24-hour change. */
  snapshotAtOrBefore(at: Date): Promise<IndexSnapshot | null>;
  earliestSnapshotAt(): Promise<Date | null>;
  /**
   * The index between `from` and `to`, reduced to at most `buckets` points by
   * keeping the last snapshot in each equal-width time bucket.
   */
  indexHistory(from: Date, to: Date, buckets: number): Promise<HistoryPoint[]>;
}

export function bucketWidthMs(from: Date, to: Date, buckets: number): number {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / Math.max(1, buckets)));
}
