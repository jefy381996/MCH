import {
  deltaGlyph,
  deltaWords,
  fmtAgo,
  fmtDate,
  fmtLondon,
  fmtNumber,
  fmtPct,
} from '../lib/format.ts';
import { RollingNumber } from '../fx/RollingNumber.tsx';
import type { IndexPayload } from '../lib/api.ts';
import type { Connection } from '../lib/useLiveIndex.ts';

const STATUS_TEXT = {
  live: 'Live',
  delayed: 'Delayed',
  closed: 'Markets closed',
  waiting: 'Waiting for prices',
} as const;

/** A change, read out as words ("up 0.42%") rather than as a triangle glyph. */
export function Delta({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span aria-hidden="true">
        {deltaGlyph(value)} <b>{fmtPct(value)}</b> {label}
      </span>
      <span className="visually-hidden">
        {deltaWords(value)} {fmtPct(Math.abs(value))} {label}
      </span>
    </span>
  );
}

export function Hero({
  data,
  baseDate,
  connection,
}: {
  data: IndexPayload | null;
  baseDate?: string;
  connection: Connection;
}) {
  const isDemo = data?.dataSource.isDemo ?? false;
  const snapshot = data?.snapshot;
  const state = data?.status ?? 'waiting';
  return (
    <section className="card" aria-labelledby="hero-label">
      <div className="hero">
        <div>
          <p className="hero-label" id="hero-label">
            MCH Index
            {isDemo && <span className="demo-chip">Demo prices</span>}
          </p>
          <p className="hero-value">
            {snapshot ? <RollingNumber value={fmtNumber(snapshot.index)} /> : '—'}
          </p>
          {snapshot && (
            <div className="deltas">
              <Delta
                value={snapshot.changeSinceBasePct}
                label={baseDate ? `since ${fmtDate(baseDate)}` : 'since base'}
              />
              {data?.change24hPct !== null && data?.change24hPct !== undefined && (
                <Delta value={data.change24hPct} label="in 24 hours" />
              )}
            </div>
          )}
        </div>
        <div className="status" data-state={state}>
          <span className="dot" aria-hidden="true" />
          <span>
            {/* Only the state is announced; the clock ticking is not. */}
            <span role="status">{STATUS_TEXT[state]}</span>
            {snapshot && (
              <>
                {' · '}
                {state === 'live' ? 'updated' : 'last price'} {fmtLondon(snapshot.computedAt)}{' '}
                London ({fmtAgo(snapshot.computedAt)})
              </>
            )}
            {connection === 'polling' && ' · reconnecting'}
          </span>
        </div>
      </div>
    </section>
  );
}
