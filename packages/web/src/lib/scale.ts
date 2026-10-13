/** Small, dependency-free chart maths. Pure functions, unit tested. */

export interface Point {
  t: number;
  v: number;
}

export function extent(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

function niceStep(rawStep: number): number {
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Round tick values covering [lo, hi], roughly `count` of them, and the padded domain. */
export function niceTicks(
  lo: number,
  hi: number,
  count = 5,
): { ticks: number[]; domain: [number, number] } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { ticks: [], domain: [0, 1] };
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.01 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep((hi - lo) / Math.max(1, count - 1));
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { ticks, domain: [start, end] };
}

/** Decimal places that make ticks of this step distinct. */
export function tickDecimals(ticks: number[]): number {
  if (ticks.length < 2) return 0;
  const step = Math.abs(ticks[1]! - ticks[0]!);
  return step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
}

export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** Index of the point whose time is closest to `t`. Points must be sorted by time. */
export function nearestIndex(points: Point[], t: number): number {
  if (points.length === 0) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1]!.t - t) <= Math.abs(points[lo]!.t - t)) return lo - 1;
  return lo;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const STEPS = [
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  91 * DAY,
];

/**
 * Evenly spaced time ticks aligned to London midnight/hours, aiming for at
 * most `maxTicks` labels across the span.
 */
export function timeTicks(
  from: number,
  to: number,
  maxTicks: number,
): { ticks: number[]; step: number } {
  const span = Math.max(1, to - from);
  const step = STEPS.find((s) => span / s <= maxTicks) ?? STEPS[STEPS.length - 1]!;
  const offset = londonOffsetMs(from);
  const first = Math.ceil((from + offset) / step) * step - offset;
  const ticks: number[] = [];
  for (let t = first; t <= to; t += step) ticks.push(t);
  return { ticks, step };
}

/** Milliseconds London is ahead of UTC at `t` (0 in winter, 1 h in summer). */
export function londonOffsetMs(t: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(t));
  const londonHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const utcHour = new Date(t).getUTCHours();
  return ((londonHour - utcHour + 24) % 24) * HOUR;
}

export function timeTickLabel(t: number, step: number): string {
  const opts: Intl.DateTimeFormatOptions =
    step < DAY
      ? { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }
      : step < 30 * DAY
        ? { timeZone: 'Europe/London', day: 'numeric', month: 'short' }
        : { timeZone: 'Europe/London', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('en-GB', opts).format(new Date(t));
}
