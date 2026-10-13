/**
 * Fixed-point helpers. Every money amount in MCH is an integer count of
 * micro-dollars (USD x 10^6) held in a bigint. Floating point is used only for
 * display, never for anything that is stored, compared or published on-chain.
 */

export const MICRO = 1_000_000n;
export const MICRO_DECIMALS = 6;

const DECIMAL_RE = /^(\d+)(?:\.(\d{1,6}))?$/;

/** Parses a non-negative decimal string such as "4012.35" into micro-units. */
export function parseMicro(text: string): bigint {
  const match = DECIMAL_RE.exec(text.trim());
  if (!match) {
    throw new RangeError(`Not a non-negative decimal with at most 6 places: "${text}"`);
  }
  const whole = match[1] ?? '0';
  const frac = (match[2] ?? '').padEnd(MICRO_DECIMALS, '0');
  return BigInt(whole) * MICRO + BigInt(frac);
}

/**
 * Converts a JSON number from a data provider into micro-units, rounding to the
 * nearest micro. toFixed() rounds in decimal, so 0.1 + 0.2 style noise is gone.
 */
export function microFromNumber(value: number): bigint {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Expected a finite non-negative number, got ${value}`);
  }
  return parseMicro(value.toFixed(MICRO_DECIMALS));
}

/** Formats micro-units as a decimal string, rounding half-up to `places`. */
export function formatMicro(value: bigint, places: number = MICRO_DECIMALS): string {
  if (places < 0 || places > MICRO_DECIMALS || !Number.isInteger(places)) {
    throw new RangeError(`places must be an integer in 0..${MICRO_DECIMALS}`);
  }
  const negative = value < 0n;
  let abs = negative ? -value : value;
  const drop = 10n ** BigInt(MICRO_DECIMALS - places);
  abs = (abs + drop / 2n) / drop;
  const scale = 10n ** BigInt(places);
  const whole = abs / scale;
  const frac = abs % scale;
  const body = places === 0 ? `${whole}` : `${whole}.${frac.toString().padStart(places, '0')}`;
  return negative && abs !== 0n ? `-${body}` : body;
}

/** Converts micro-units to a JS number. Display only. */
export function microToNumber(value: bigint): number {
  return Number(value) / Number(MICRO);
}

/**
 * Percentage change from `from` to `to`, e.g. 4000 -> 4400 gives 10. Computed in
 * integers to 6 decimal places, then handed to a number for display.
 */
export function percentChange(from: bigint, to: bigint): number {
  if (from <= 0n) throw new RangeError('percentChange: `from` must be positive');
  const scaled = ((to - from) * 100n * MICRO) / from;
  return Number(scaled) / Number(MICRO);
}
