/**
 * Display formatting. Values arrive as exact decimal strings from the API;
 * converting to number here is for display only.
 */

const LONDON = 'Europe/London';

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function fmtNumber(value: string | number, decimals = 2): string {
  return toNumber(value).toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtUsd(value: string | number, decimals = 2): string {
  return `$${fmtNumber(value, decimals)}`;
}

/** Signed percentage, e.g. +1.75% or −0.32% (true minus sign). */
export function fmtPct(value: number, decimals = 2): string {
  const rounded = Number(value.toFixed(decimals));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toFixed(decimals)}%`;
}

/** Direction glyph that carries meaning without colour. */
export function deltaGlyph(value: number, decimals = 2): '▲' | '▼' | '–' {
  const rounded = Number(value.toFixed(decimals));
  return rounded > 0 ? '▲' : rounded < 0 ? '▼' : '–';
}

export function deltaWords(value: number, decimals = 2): string {
  const rounded = Number(value.toFixed(decimals));
  return rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'unchanged';
}

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const dayTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "Fri 10 Oct, 18:59" in London, always to the minute. For charts and tables. */
export function fmtLondonMinute(iso: string): string {
  return dayTimeFmt.format(new Date(iso));
}

/** "14:32:05" today in London, "Fri 10 Oct, 18:59" otherwise. */
export function fmtLondon(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay = dateFmt.format(d) === dateFmt.format(now);
  return sameDay ? timeFmt.format(d) : dayTimeFmt.format(d);
}

export function fmtDate(isoOrDate: string): string {
  return dateFmt.format(new Date(isoOrDate));
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function fmtAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function fmtWeight(ppm: number): string {
  const pct = ppm / 10_000;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** Token amount from base units, e.g. 1234500000n with 6 decimals -> "1,234.5". */
export function fmtTokenAmount(baseUnits: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = baseUnits / scale;
  const frac = (baseUnits % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  const wholeText = whole.toLocaleString('en-GB');
  return frac ? `${wholeText}.${frac}` : wholeText;
}

export function shorten(hex: string, keep = 8): string {
  return hex.length <= keep * 2 + 1 ? hex : `${hex.slice(0, keep)}…${hex.slice(-keep)}`;
}
