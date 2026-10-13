import { describe, expect, it } from 'vitest';
import {
  londonOffsetMs,
  nearestIndex,
  niceTicks,
  tickDecimals,
  timeTicks,
  timeTickLabel,
} from '../src/lib/scale.ts';

describe('niceTicks', () => {
  it('produces round ticks that cover the data', () => {
    const { ticks, domain } = niceTicks(98.3, 101.9, 5);
    expect(ticks).toEqual([98, 99, 100, 101, 102]);
    expect(domain).toEqual([98, 102]);
  });

  it('handles a flat series without dividing by zero', () => {
    const { ticks, domain } = niceTicks(100, 100, 5);
    expect(domain[0]).toBeLessThan(100);
    expect(domain[1]).toBeGreaterThan(100);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it('chooses enough decimals to tell ticks apart', () => {
    expect(tickDecimals(niceTicks(99.9, 100.1, 5).ticks)).toBe(2);
    expect(tickDecimals([98, 100, 102])).toBe(0);
  });
});

describe('nearestIndex', () => {
  const pts = [0, 10, 20, 30].map((t) => ({ t, v: t }));
  it.each([
    [-5, 0],
    [4, 0],
    [5, 0],
    [6, 1],
    [26, 3],
    [99, 3],
  ])('t=%i -> %i', (t, expected) => {
    expect(nearestIndex(pts, t)).toBe(expected);
  });
  it('returns -1 for no points', () => {
    expect(nearestIndex([], 1)).toBe(-1);
  });
});

describe('time ticks', () => {
  it('knows when London is on summer time', () => {
    expect(londonOffsetMs(Date.parse('2026-07-01T12:00:00Z'))).toBe(3_600_000);
    expect(londonOffsetMs(Date.parse('2026-12-01T12:00:00Z'))).toBe(0);
  });

  it('aligns daily ticks to London midnight', () => {
    const from = Date.parse('2026-10-06T13:00:00Z');
    const to = Date.parse('2026-10-13T13:00:00Z');
    const { ticks, step } = timeTicks(from, to, 8);
    expect(step).toBe(86_400_000);
    expect(new Date(ticks[0]!).toISOString()).toBe('2026-10-06T23:00:00.000Z');
    expect(timeTickLabel(ticks[0]!, step)).toBe('7 Oct');
  });

  it('uses hours for a one-day chart', () => {
    const to = Date.parse('2026-10-13T13:00:00Z');
    const { step, ticks } = timeTicks(to - 86_400_000, to, 6);
    expect(step).toBe(6 * 3_600_000);
    expect(timeTickLabel(ticks[0]!, step)).toMatch(/^\d\d:00$/);
  });
});
