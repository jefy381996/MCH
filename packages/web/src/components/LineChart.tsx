import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  extent,
  linear,
  nearestIndex,
  niceTicks,
  tickDecimals,
  timeTickLabel,
  timeTicks,
  type Point,
} from '../lib/scale.ts';

interface Props {
  points: Point[];
  height: number;
  /** Accessible name, e.g. "MCH Index, last 30 days". */
  label: string;
  formatValue: (v: number) => string;
  formatTime: (t: number) => string;
  /** Fixed y domain, so small multiples share one scale. */
  yDomain?: [number, number];
  /** A hairline to read against, e.g. the base value of 100. */
  reference?: { value: number; label: string };
  compact?: boolean;
  /** Hold the previous render at reduced opacity while new data loads. */
  refreshing?: boolean;
}

/**
 * Single-series line chart: 2px line, 10% area wash, hairline grid, an
 * end-dot with a surface ring and a direct end label. A crosshair snaps to
 * the nearest point; arrow keys do the same for keyboard users.
 */
export function LineChart(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const m = p.compact
    ? { top: 10, right: 54, bottom: 24, left: 38 }
    : { top: 14, right: 70, bottom: 30, left: 48 };
  const innerW = Math.max(10, width - m.left - m.right);
  const innerH = Math.max(10, p.height - m.top - m.bottom);

  const geometry = useMemo(() => {
    if (p.points.length === 0) return null;
    const values = p.points.map((pt) => pt.v);
    let [lo, hi] = p.yDomain ?? extent(values);
    if (!p.yDomain && p.reference) {
      const span = Math.max(hi - lo, Math.abs(hi) * 0.002);
      const r = p.reference.value;
      if (r >= lo - span * 0.5 && r <= hi + span * 0.5) {
        lo = Math.min(lo, r);
        hi = Math.max(hi, r);
      }
    }
    const { ticks, domain } = niceTicks(lo, hi, p.compact ? 3 : 5);
    const first = p.points[0]!.t;
    const last = p.points[p.points.length - 1]!.t;
    const tSpan: [number, number] = first === last ? [first - 1, last + 1] : [first, last];
    const x = linear(tSpan, [0, innerW]);
    const y = linear(domain, [innerH, 0]);
    const line = p.points
      .map((pt, i) => `${i ? 'L' : 'M'}${x(pt.t).toFixed(1)},${y(pt.v).toFixed(1)}`)
      .join('');
    const area = `${line}L${x(last).toFixed(1)},${innerH}L${x(first).toFixed(1)},${innerH}Z`;
    const time = timeTicks(
      tSpan[0],
      tSpan[1],
      Math.max(3, Math.floor(innerW / (p.compact ? 110 : 120))),
    );
    return { ticks, domain, x, y, line, area, time, decimals: tickDecimals(ticks), tSpan };
  }, [p.points, p.yDomain, p.reference, p.compact, innerW, innerH]);

  if (!geometry) {
    return (
      <div className="chart" ref={wrapRef} style={{ height: p.height }}>
        <p className="note">No history yet.</p>
      </div>
    );
  }

  const { x, y } = geometry;
  const lastIndex = p.points.length - 1;
  const lastPoint = p.points[lastIndex]!;
  const hovered = hover === null ? null : p.points[hover];
  const refInDomain =
    p.reference &&
    p.reference.value >= geometry.domain[0] &&
    p.reference.value <= geometry.domain[1];

  const onPointer = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    const t = geometry.tSpan[0] + (px / innerW) * (geometry.tSpan[1] - geometry.tSpan[0]);
    setHover(nearestIndex(p.points, t));
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const current = hover ?? lastIndex;
    const next =
      event.key === 'ArrowLeft'
        ? Math.max(0, current - step)
        : event.key === 'ArrowRight'
          ? Math.min(lastIndex, current + step)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? lastIndex
              : event.key === 'Escape'
                ? null
                : undefined;
    if (next !== undefined) {
      event.preventDefault();
      setHover(next);
    }
  };

  const tooltipLeft = hovered ? Math.min(Math.max(m.left + x(hovered.t) + 12, 0), width - 170) : 0;
  const first = p.points[0]!;
  const summary = `${p.label}. From ${p.formatValue(first.v)} to ${p.formatValue(lastPoint.v)}.`;

  return (
    <div
      className={`chart${p.refreshing ? ' refreshing' : ''}`}
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onFocus={() => setHover((h) => h ?? lastIndex)}
      onBlur={() => setHover(null)}
      aria-label={`${summary} Use the arrow keys to read values.`}
    >
      <svg height={p.height} role="img" aria-label={summary}>
        <g transform={`translate(${m.left},${m.top})`}>
          {geometry.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                x2={innerW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text className="tick" x={-8} y={y(tick)} dy="0.32em" textAnchor="end">
                {tick.toFixed(geometry.decimals)}
              </text>
            </g>
          ))}
          {refInDomain && p.reference && (
            <g>
              <line
                x1={0}
                x2={innerW}
                y1={y(p.reference.value)}
                y2={y(p.reference.value)}
                stroke="var(--axis)"
                strokeWidth={1}
              />
              {!p.compact && (
                <text className="tick" x={4} y={y(p.reference.value) - 6}>
                  {p.reference.label}
                </text>
              )}
            </g>
          )}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="var(--axis)" strokeWidth={1} />
          {geometry.time.ticks.map((t) => (
            <text key={t} className="tick" x={x(t)} y={innerH + 18} textAnchor="middle">
              {timeTickLabel(t, geometry.time.step)}
            </text>
          ))}
          <path d={geometry.area} fill="var(--series-1-wash)" stroke="none" />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={x(lastPoint.t)}
            cy={y(lastPoint.v)}
            r={4}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
          <text className="end-label" x={x(lastPoint.t) + 10} y={y(lastPoint.v)} dy="0.32em">
            {p.formatValue(lastPoint.v)}
          </text>
          {hovered && (
            <g pointerEvents="none">
              <line
                x1={x(hovered.t)}
                x2={x(hovered.t)}
                y1={0}
                y2={innerH}
                stroke="var(--axis-ink)"
                strokeWidth={1}
              />
              <circle
                cx={x(hovered.t)}
                cy={y(hovered.v)}
                r={4}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHover(null)}
            style={{ touchAction: 'pan-y' }}
          />
        </g>
      </svg>
      {hovered && (
        <div className="tooltip" style={{ left: tooltipLeft, top: m.top }}>
          <div className="value">
            <span className="key" aria-hidden="true" />
            {p.formatValue(hovered.v)}
          </div>
          <div className="time">{p.formatTime(hovered.t)}</div>
        </div>
      )}
      <div className="visually-hidden" aria-live="polite">
        {hovered ? `${p.formatValue(hovered.v)} at ${p.formatTime(hovered.t)}` : ''}
      </div>
    </div>
  );
}

/** The table twin of a chart: every value, no hovering required. */
export function DataTable(props: {
  caption: string;
  rows: Array<{ time: string; values: string[] }>;
  headers: string[];
}) {
  return (
    <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto', marginTop: 12 }}>
      <table>
        <caption className="visually-hidden">{props.caption}</caption>
        <thead>
          <tr>
            <th scope="col">Time (London)</th>
            {props.headers.map((h) => (
              <th key={h} scope="col" className="num">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.time}>
              <td>{row.time}</td>
              {row.values.map((v, i) => (
                <td key={props.headers[i]} className="num">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
