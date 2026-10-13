import { buildSnapshot, type IndexSnapshot } from '@mch/index-core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemoryPriceStore } from '../src/store/memory-store.ts';
import { PostgresPriceStore } from '../src/store/postgres-store.ts';
import type { PriceStore } from '../src/store/price-store.ts';
import { allAt, basket, quote } from './fixtures.ts';

const T0 = Date.parse('2026-10-13T00:00:00Z');
const HOUR = 3_600_000;

function snapshotAt(hours: number, goldFactor = 1): IndexSnapshot {
  const at = T0 + hours * HOUR;
  const latest = Object.fromEntries(allAt(at, { XAU: goldFactor }).map((q) => [q.metal, q]));
  return buildSnapshot(basket, latest, new Date(at));
}

/** The same behavioural contract, run against every PriceStore implementation. */
function storeContract(name: string, make: () => Promise<PriceStore>) {
  describe(name, () => {
    let store: PriceStore;
    beforeAll(async () => {
      store = await make();
      await store.init();
    });
    afterAll(async () => {
      await store.close();
    });

    it('starts empty', async () => {
      expect(await store.isEmpty()).toBe(true);
      expect(await store.latestSnapshot()).toBeNull();
      expect(await store.earliestSnapshotAt()).toBeNull();
    });

    it('keeps the newest quote per metal', async () => {
      await store.saveQuotes([quote('XAU', 4_000_000_000n, T0), quote('XAG', 48_000_000n, T0)]);
      await store.saveQuotes([quote('XAU', 4_100_000_000n, T0 + HOUR)]);
      const latest = await store.latestQuotes();
      expect(latest.XAU?.priceMicro).toBe(4_100_000_000n);
      expect(latest.XAU?.observedAt).toEqual(new Date(T0 + HOUR));
      expect(latest.XAG?.priceMicro).toBe(48_000_000n);
      expect(await store.isEmpty()).toBe(false);
    });

    it('ignores an exact duplicate quote', async () => {
      await store.saveQuotes([quote('XAG', 48_000_000n, T0)]);
      expect((await store.latestQuotes()).XAG?.priceMicro).toBe(48_000_000n);
    });

    it('round-trips snapshots without losing a micro', async () => {
      const snaps = Array.from({ length: 48 }, (_, h) => snapshotAt(h, 1 + h / 1000));
      await store.saveSnapshots(snaps);
      const latest = await store.latestSnapshot();
      expect(latest).toEqual(snaps[47]);
      expect(await store.earliestSnapshotAt()).toEqual(new Date(T0));
    });

    it('finds the snapshot at or before a time', async () => {
      const s = await store.snapshotAtOrBefore(new Date(T0 + 10.5 * HOUR));
      expect(s?.computedAt).toEqual(new Date(T0 + 10 * HOUR));
      expect(await store.snapshotAtOrBefore(new Date(T0 - 1))).toBeNull();
    });

    it('downsamples history to the last snapshot per bucket', async () => {
      const points = await store.indexHistory(new Date(T0), new Date(T0 + 47 * HOUR), 12);
      expect(points.length).toBeLessThanOrEqual(12);
      expect(points.length).toBeGreaterThanOrEqual(11);
      expect(points[0]!.at).toEqual(new Date(T0 + 3 * HOUR));
      // Ascending, and the final point is the newest snapshot.
      for (let i = 1; i < points.length; i++) {
        expect(points[i]!.at.getTime()).toBeGreaterThan(points[i - 1]!.at.getTime());
      }
      expect(points[points.length - 1]!.at).toEqual(new Date(T0 + 47 * HOUR));
      expect(points[points.length - 1]!.indexMicro).toBe(snapshotAt(47, 1.047).indexMicro);
    });

    it('returns nothing for an empty window', async () => {
      expect(
        await store.indexHistory(new Date(T0 + 100 * HOUR), new Date(T0 + 200 * HOUR), 10),
      ).toEqual([]);
    });
  });
}

storeContract('MemoryPriceStore', async () => new MemoryPriceStore());

const pgUrl = process.env.TEST_DATABASE_URL;
if (pgUrl) {
  storeContract('PostgresPriceStore', async () => {
    const admin = new pg.Client({ connectionString: pgUrl });
    await admin.connect();
    await admin.query(
      'DROP TABLE IF EXISTS price_quotes, index_snapshots, schema_migrations CASCADE',
    );
    await admin.end();
    return new PostgresPriceStore(pgUrl);
  });

  describe('PostgresPriceStore migrations', () => {
    it('are idempotent across restarts', async () => {
      const a = new PostgresPriceStore(pgUrl);
      await a.init();
      await a.init();
      await a.close();
    });
  });
} else {
  describe.skip('PostgresPriceStore (set TEST_DATABASE_URL to run)', () => {
    it('skipped', () => {});
  });
}
