import {
  isMetalId,
  parseMicro,
  formatMicro,
  type IndexSnapshot,
  type MetalId,
  type PriceQuote,
  type SnapshotComponent,
} from '@mch/index-core';
import pg from 'pg';
import { MIGRATIONS } from './migrations.ts';
import { bucketWidthMs, type HistoryPoint, type PriceStore } from './price-store.ts';

interface StoredComponent {
  metal: string;
  weightPpm: number;
  basePrice: string;
  price: string;
  observedAt: string;
  source: string;
  contribution: string;
}

function toStored(c: SnapshotComponent): StoredComponent {
  return {
    metal: c.metal,
    weightPpm: c.weightPpm,
    basePrice: formatMicro(c.basePriceMicro),
    price: formatMicro(c.priceMicro),
    observedAt: c.observedAt.toISOString(),
    source: c.source,
    contribution: formatMicro(c.contributionMicro),
  };
}

function fromStored(c: StoredComponent): SnapshotComponent {
  if (!isMetalId(c.metal)) throw new Error(`Unknown metal in database: ${c.metal}`);
  return {
    metal: c.metal,
    weightPpm: c.weightPpm,
    basePriceMicro: parseMicro(c.basePrice),
    priceMicro: parseMicro(c.price),
    observedAt: new Date(c.observedAt),
    source: c.source,
    contributionMicro: parseMicro(c.contribution),
  };
}

interface SnapshotRow {
  computed_at: Date;
  index_micro: string;
  basket_version: number;
  components: StoredComponent[];
}

function rowToSnapshot(row: SnapshotRow): IndexSnapshot {
  return {
    computedAt: row.computed_at,
    indexMicro: BigInt(row.index_micro),
    basketVersion: row.basket_version,
    components: row.components.map(fromStored),
  };
}

export class PostgresPriceStore implements PriceStore {
  readonly kind = 'postgres';
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 5 });
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // One process migrates at a time, even if several start together.
      await client.query('SELECT pg_advisory_lock(727272)');
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
      const done = new Set(
        (await client.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map(
          (r) => r.id,
        ),
      );
      for (const m of MIGRATIONS) {
        if (done.has(m.id)) continue;
        await client.query('BEGIN');
        try {
          await client.query(m.sql);
          await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(727272)').catch(() => {});
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async isEmpty(): Promise<boolean> {
    const { rows } = await this.pool.query<{ empty: boolean }>(
      `SELECT NOT EXISTS (SELECT 1 FROM index_snapshots)
          AND NOT EXISTS (SELECT 1 FROM price_quotes) AS empty`,
    );
    return rows[0]!.empty;
  }

  async saveQuotes(quotes: PriceQuote[]): Promise<void> {
    if (quotes.length === 0) return;
    await this.pool.query(
      `INSERT INTO price_quotes (metal, price_micro, observed_at, source)
       SELECT * FROM UNNEST($1::text[], $2::bigint[], $3::timestamptz[], $4::text[])
       ON CONFLICT (metal, source, observed_at) DO NOTHING`,
      [
        quotes.map((q) => q.metal),
        quotes.map((q) => q.priceMicro.toString()),
        quotes.map((q) => q.observedAt.toISOString()),
        quotes.map((q) => q.source),
      ],
    );
  }

  async saveSnapshots(snapshots: IndexSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;
    await this.pool.query(
      `INSERT INTO index_snapshots (computed_at, index_micro, basket_version, components)
       SELECT * FROM UNNEST($1::timestamptz[], $2::bigint[], $3::int[], $4::jsonb[])`,
      [
        snapshots.map((s) => s.computedAt.toISOString()),
        snapshots.map((s) => s.indexMicro.toString()),
        snapshots.map((s) => s.basketVersion),
        snapshots.map((s) => JSON.stringify(s.components.map(toStored))),
      ],
    );
  }

  async latestQuotes(): Promise<Partial<Record<MetalId, PriceQuote>>> {
    const { rows } = await this.pool.query<{
      metal: string;
      price_micro: string;
      observed_at: Date;
      source: string;
    }>(
      `SELECT DISTINCT ON (metal) metal, price_micro, observed_at, source
         FROM price_quotes ORDER BY metal, observed_at DESC`,
    );
    const latest: Partial<Record<MetalId, PriceQuote>> = {};
    for (const r of rows) {
      if (!isMetalId(r.metal)) continue;
      latest[r.metal] = {
        metal: r.metal,
        priceMicro: BigInt(r.price_micro),
        observedAt: r.observed_at,
        source: r.source,
      };
    }
    return latest;
  }

  async latestSnapshot(): Promise<IndexSnapshot | null> {
    const { rows } = await this.pool.query<SnapshotRow>(
      `SELECT computed_at, index_micro, basket_version, components
         FROM index_snapshots ORDER BY computed_at DESC, id DESC LIMIT 1`,
    );
    return rows[0] ? rowToSnapshot(rows[0]) : null;
  }

  async snapshotAtOrBefore(at: Date): Promise<IndexSnapshot | null> {
    const { rows } = await this.pool.query<SnapshotRow>(
      `SELECT computed_at, index_micro, basket_version, components
         FROM index_snapshots WHERE computed_at <= $1
        ORDER BY computed_at DESC, id DESC LIMIT 1`,
      [at.toISOString()],
    );
    return rows[0] ? rowToSnapshot(rows[0]) : null;
  }

  async earliestSnapshotAt(): Promise<Date | null> {
    const { rows } = await this.pool.query<{ at: Date | null }>(
      'SELECT min(computed_at) AS at FROM index_snapshots',
    );
    return rows[0]?.at ?? null;
  }

  async indexHistory(from: Date, to: Date, buckets: number): Promise<HistoryPoint[]> {
    const widthMs = bucketWidthMs(from, to, buckets);
    const { rows } = await this.pool.query<{ computed_at: Date; index_micro: string }>(
      `SELECT DISTINCT ON (bucket) computed_at, index_micro
         FROM (
           SELECT LEAST($4::int - 1, floor(extract(epoch FROM (computed_at - $1::timestamptz)) * 1000 / $3)) AS bucket,
                  computed_at, index_micro, id
             FROM index_snapshots
            WHERE computed_at >= $1 AND computed_at <= $2
         ) b
        ORDER BY bucket, computed_at DESC, id DESC`,
      [from.toISOString(), to.toISOString(), widthMs, Math.max(1, buckets)],
    );
    return rows.map((r) => ({ at: r.computed_at, indexMicro: BigInt(r.index_micro) }));
  }
}
