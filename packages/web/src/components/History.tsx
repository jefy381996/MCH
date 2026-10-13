import { METALS, type BasketFile, type MetalId } from '@mch/index-core';
import { useEffect, useMemo, useState } from 'react';
import { getJSON, type HistoryPayload, type IndexPayload, type Range } from '../lib/api.ts';
import { fmtLondonMinute, fmtNumber, fmtPct, fmtUsd } from '../lib/format.ts';
import { extent, niceTicks, type Point } from '../lib/scale.ts';
import { DataTable, LineChart } from './LineChart.tsx';

const RANGES: Array<{ id: Range; label: string; long: string }> = [
  { id: '1d', label: '1D', long: 'last 24 hours' },
  { id: '7d', label: '7D', long: 'last 7 days' },
  { id: '30d', label: '30D', long: 'last 30 days' },
  { id: '90d', label: '90D', long: 'last 90 days' },
  { id: '1y', label: '1Y', long: 'last year' },
  { id: 'all', label: 'All', long: 'all history' },
];
const REFRESH_MS = 60_000;

const timeLabel = (t: number) => fmtLondonMinute(new Date(t).toISOString());

export function History({
  live,
  basket,
}: {
  live: IndexPayload | null;
  basket: BasketFile | null;
}) {
  const [range, setRange] = useState<Range>('30d');
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      setLoading(true);
      getJSON<HistoryPayload>(`/api/index/history?range=${range}`, controller.signal)
        .then(setHistory)
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [range]);

  // History plus the newest live value, so the right edge moves in real time.
  const indexPoints = useMemo<Point[]>(() => {
    const pts = (history?.points ?? []).map((p) => ({ t: Date.parse(p.t), v: Number(p.index) }));
    const snap = live?.snapshot;
    if (snap) {
      const t = Date.parse(snap.computedAt);
      if (pts.length === 0 || t > pts[pts.length - 1]!.t) pts.push({ t, v: Number(snap.index) });
    }
    return pts;
  }, [history, live]);

  const metals = useMemo(() => {
    if (!basket) return [];
    return basket.components.map((c) => {
      const base = Number(c.basePrice);
      const pts: Point[] = (history?.points ?? []).flatMap((p) => {
        const price = p.prices[c.metal as MetalId];
        return price ? [{ t: Date.parse(p.t), v: (Number(price) / base) * 100 }] : [];
      });
      const liveC = live?.snapshot?.components.find((x) => x.metal === c.metal);
      if (liveC && live?.snapshot) {
        const t = Date.parse(live.snapshot.computedAt);
        if (pts.length === 0 || t > pts[pts.length - 1]!.t)
          pts.push({ t, v: (Number(liveC.price) / base) * 100 });
      }
      return { metal: c.metal as MetalId, base, points: pts, price: liveC?.price };
    });
  }, [basket, history, live]);

  // One shared scale for every small multiple, always including the base of 100.
  const sharedDomain = useMemo<[number, number] | undefined>(() => {
    const all = metals.flatMap((m) => m.points.map((p) => p.v));
    if (all.length === 0) return undefined;
    const [lo, hi] = extent([...all, 100]);
    return niceTicks(lo, hi, 3).domain;
  }, [metals]);

  const rangeLong = RANGES.find((r) => r.id === range)!.long;

  return (
    <section aria-labelledby="history-title" style={{ marginTop: 32 }}>
      <h2 id="history-title" style={{ fontSize: 20, margin: 0, letterSpacing: '-0.01em' }}>
        History
      </h2>
      <div className="filters" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="card">
        <h2>MCH Index</h2>
        <p className="sub">Index value, {rangeLong}. 100 is the value on the base date.</p>
        <LineChart
          points={indexPoints}
          height={300}
          label={`MCH Index, ${rangeLong}`}
          formatValue={(v) => fmtNumber(v)}
          formatTime={timeLabel}
          reference={{ value: 100, label: 'Base = 100' }}
          refreshing={loading && !!history}
        />
        <div className="chart-foot">
          <span>Times are London time.</span>
          <button type="button" className="link-button" onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'Hide data table' : 'Show data table'}
          </button>
        </div>
        {showTable && (
          <DataTable
            caption={`MCH Index, ${rangeLong}`}
            headers={['Index']}
            rows={[...indexPoints]
              .reverse()
              .map((p) => ({ time: timeLabel(p.t), values: [fmtNumber(p.v)] }))}
          />
        )}
      </div>

      <div className="card">
        <h2>Each metal since the base date</h2>
        <p className="sub">
          Every metal rebased to 100 on the base date and drawn on the same scale, so the moves
          compare directly.
        </p>
        <div className="multiples">
          {metals.map((m) => {
            const last = m.points[m.points.length - 1];
            return (
              <div className="multiple" key={m.metal}>
                <h3>
                  {METALS[m.metal].name}
                  <span>
                    {m.price ? `${fmtUsd(m.price, m.metal === 'NI' ? 0 : 2)} · ` : ''}
                    {last ? fmtPct(last.v - 100) : ''}
                  </span>
                </h3>
                <LineChart
                  points={m.points}
                  height={150}
                  compact
                  label={`${METALS[m.metal].name} rebased to 100, ${rangeLong}`}
                  formatValue={(v) => fmtNumber(v, 1)}
                  formatTime={timeLabel}
                  yDomain={sharedDomain}
                  reference={{ value: 100, label: 'Base' }}
                  refreshing={loading && !!history}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
