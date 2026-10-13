import { describe, expect, it } from 'vitest';
import {
  deltaGlyph,
  fmtAgo,
  fmtLondon,
  fmtNumber,
  fmtPct,
  fmtTokenAmount,
  fmtUsd,
  fmtWeight,
  shorten,
} from '../src/lib/format.ts';

describe('number formatting', () => {
  it('groups thousands and fixes decimals', () => {
    expect(fmtNumber('101.750000')).toBe('101.75');
    expect(fmtUsd('15512.250000')).toBe('$15,512.25');
    expect(fmtUsd('4012.345678', 0)).toBe('$4,012');
  });

  it('signs percentages with a true minus and rounds before choosing the sign', () => {
    expect(fmtPct(1.75)).toBe('+1.75%');
    expect(fmtPct(-0.3249)).toBe('−0.32%');
    expect(fmtPct(-0.001)).toBe('0.00%');
    expect(deltaGlyph(-0.001)).toBe('–');
    expect(deltaGlyph(0.5)).toBe('▲');
    expect(deltaGlyph(-2)).toBe('▼');
  });

  it('formats weights and token amounts', () => {
    expect(fmtWeight(250_000)).toBe('25%');
    expect(fmtWeight(333_333)).toBe('33.33%');
    expect(fmtTokenAmount(1_234_500_000n, 6)).toBe('1,234.5');
    expect(fmtTokenAmount(100_000_000_000_000n, 6)).toBe('100,000,000');
    expect(fmtTokenAmount(1n, 6)).toBe('0.000001');
  });

  it('shortens long hashes in the middle', () => {
    expect(shorten('a'.repeat(56))).toBe('aaaaaaaa…aaaaaaaa');
    expect(shorten('abc')).toBe('abc');
  });
});

describe('time formatting', () => {
  const now = new Date('2026-10-13T13:00:00Z');

  it('shows London time, with the day when it is not today', () => {
    // 13 Oct is BST (UTC+1).
    expect(fmtLondon('2026-10-13T12:32:05Z', now)).toBe('13:32:05');
    expect(fmtLondon('2026-10-10T17:59:00Z', now)).toBe('Sat 10 Oct, 18:59');
  });

  it('describes age in plain words', () => {
    expect(fmtAgo('2026-10-13T12:59:30Z', now)).toBe('just now');
    expect(fmtAgo('2026-10-13T12:56:00Z', now)).toBe('4 min ago');
    expect(fmtAgo('2026-10-13T10:00:00Z', now)).toBe('3 h ago');
    expect(fmtAgo('2026-10-10T13:00:00Z', now)).toBe('3 days ago');
  });
});
