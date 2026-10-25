import { useId } from 'react';

/** A small trend line with a soft fill, no axes. Decorative: the figures sit beside it. */
export function Sparkline({
  values,
  color,
  width = 160,
  height = 44,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 4 - ((v - lo) / span) * (height - 8),
  ]);
  const line = pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)} ${y!.toFixed(1)}`)
    .join(' ');
  return (
    <svg
      className="sparkline"
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#sg-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        className="sparkline-line"
      />
    </svg>
  );
}
