import { describe, expect, it } from 'vitest';
import { formatMicro, microFromNumber, parseMicro, percentChange } from '../src/decimal.ts';

describe('parseMicro', () => {
  it.each([
    ['0', 0n],
    ['1', 1_000_000n],
    ['4012.35', 4_012_350_000n],
    ['0.000001', 1n],
    ['15500.123456', 15_500_123_456n],
    [' 7.5 ', 7_500_000n],
  ])('parses %s', (text, expected) => {
    expect(parseMicro(text)).toBe(expected);
  });

  it.each(['', '-1', '1.2345678', '1e3', 'abc', '1.', '.5', '1,000'])('rejects %j', (text) => {
    expect(() => parseMicro(text)).toThrow(RangeError);
  });
});

describe('formatMicro', () => {
  it('round-trips with parseMicro at full precision', () => {
    for (const s of ['0.000000', '1.000000', '4012.350000', '15500.123456']) {
      expect(formatMicro(parseMicro(s))).toBe(s);
    }
  });

  it('rounds half up when dropping places', () => {
    expect(formatMicro(1_235_000n, 2)).toBe('1.24');
    expect(formatMicro(1_234_999n, 2)).toBe('1.23');
    expect(formatMicro(999_999n, 2)).toBe('1.00');
    expect(formatMicro(4_012_350_000n, 0)).toBe('4012');
  });

  it('formats negatives', () => {
    expect(formatMicro(-1_500_000n, 1)).toBe('-1.5');
    expect(formatMicro(-1n, 2)).toBe('0.00');
  });
});

describe('microFromNumber', () => {
  it('removes float noise', () => {
    expect(microFromNumber(0.1 + 0.2)).toBe(300_000n);
    expect(microFromNumber(4012.35)).toBe(4_012_350_000n);
    expect(microFromNumber(15800.1234567)).toBe(15_800_123_457n);
  });

  it.each([NaN, Infinity, -1])('rejects %s', (n) => {
    expect(() => microFromNumber(n)).toThrow(RangeError);
  });
});

describe('percentChange', () => {
  it('computes signed percentage change', () => {
    expect(percentChange(4_000_000_000n, 4_400_000_000n)).toBe(10);
    expect(percentChange(48_000_000n, 45_600_000n)).toBe(-5);
    expect(percentChange(100_000_000n, 101_750_000n)).toBe(1.75);
  });
});
