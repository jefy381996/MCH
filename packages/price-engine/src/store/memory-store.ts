import type { IndexSnapshot, MetalId, PriceQuote } from '@mch/index-core';
import { bucketWidthMs, type HistoryPoint, type PriceStore } from './price-store.ts';

/** Keeps roughly a month of 5-second snapshots before discarding the oldest. */
const MAX_SNAPSHOTS = 500_000;

export class MemoryPriceStore implements PriceStore {
  readonly kind = 'memory';
  private readonly latest: Partial<Record<MetalId, PriceQuote>> = {};
  /** Sorted by computedAt ascending. */
  private snapshots: IndexSnapshot[] = [];

  async init(): Promise<void> {}
  async close(): Promise<void> {}

  async isEmpty(): Promise<boolean> {
    return this.snapshots.length === 0 && Object.keys(this.latest).length === 0;
  }

  async saveQuotes(quotes: PriceQuote[]): Promise<void> {
    for (const q of quotes) {
      const current = this.latest[q.metal];
      if (!current || q.observedAt.getTime() >= current.observedAt.getTime()) {
        this.latest[q.metal] = q;
      }
    }
  }

  async saveSnapshots(snapshots: IndexSnapshot[]): Promise<void> {
    for (const s of snapshots) {
      const last = this.snapshots[this.snapshots.length - 1];
      if (!last || s.computedAt.getTime() >= last.computedAt.getTime()) {
        this.snapshots.push(s);
      } else {
        const i = this.snapshots.findIndex((x) => x.computedAt.getTime() > s.computedAt.getTime());
        this.snapshots.splice(i, 0, s);
      }
    }
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }
  }

  async latestQuotes(): Promise<Partial<Record<MetalId, PriceQuote>>> {
    return { ...this.latest };
  }

  async latestSnapshot(): Promise<IndexSnapshot | null> {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  async snapshotAtOrBefore(at: Date): Promise<IndexSnapshot | null> {
    const t = at.getTime();
    let lo = 0;
    let hi = this.snapshots.length - 1;
    let found: IndexSnapshot | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = this.snapshots[mid]!;
      if (s.computedAt.getTime() <= t) {
        found = s;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found;
  }

  async earliestSnapshotAt(): Promise<Date | null> {
    return this.snapshots[0]?.computedAt ?? null;
  }

  async indexHistory(from: Date, to: Date, buckets: number): Promise<HistoryPoint[]> {
    const width = bucketWidthMs(from, to, buckets);
    const byBucket = new Map<number, HistoryPoint>();
    for (const s of this.snapshots) {
      const t = s.computedAt.getTime();
      if (t < from.getTime() || t > to.getTime()) continue;
      // Later snapshots overwrite earlier ones: keep the last in each bucket.
      // The window is inclusive at both ends; the very last instant belongs to the last bucket.
      const bucket = Math.min(buckets - 1, Math.floor((t - from.getTime()) / width));
      byBucket.set(bucket, {
        at: s.computedAt,
        indexMicro: s.indexMicro,
        pricesMicro: Object.fromEntries(s.components.map((c) => [c.metal, c.priceMicro])),
      });
    }
    return [...byBucket.values()];
  }
}
