/**
 * Schema changes, applied in order exactly once. Never edit a migration that
 * has shipped; add a new one.
 */
export const MIGRATIONS: ReadonlyArray<{ id: string; sql: string }> = [
  {
    id: '001_initial',
    sql: `
      CREATE TABLE price_quotes (
        id           BIGSERIAL PRIMARY KEY,
        metal        TEXT        NOT NULL,
        price_micro  BIGINT      NOT NULL CHECK (price_micro > 0),
        observed_at  TIMESTAMPTZ NOT NULL,
        source       TEXT        NOT NULL,
        received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (metal, source, observed_at)
      );
      CREATE INDEX price_quotes_by_metal_time ON price_quotes (metal, observed_at DESC);

      CREATE TABLE index_snapshots (
        id              BIGSERIAL PRIMARY KEY,
        computed_at     TIMESTAMPTZ NOT NULL,
        index_micro     BIGINT      NOT NULL CHECK (index_micro > 0),
        basket_version  INTEGER     NOT NULL,
        components      JSONB       NOT NULL
      );
      CREATE INDEX index_snapshots_by_time ON index_snapshots (computed_at DESC);
    `,
  },
];
