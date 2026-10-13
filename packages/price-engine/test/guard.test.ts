import { describe, expect, it } from 'vitest';
import { QuoteGuard } from '../src/guard.ts';
import { quote } from './fixtures.ts';

const now = new Date('2026-10-13T12:00:00Z');
const t = (minutes: number) => now.getTime() - 60 * 60_000 + minutes * 60_000;
const gold = (price: bigint, minute: number) => quote('XAU', price, t(minute));
const last = gold(4_000_000_000n, 0);

describe('QuoteGuard', () => {
  it('accepts the first quote for a metal', () => {
    expect(new QuoteGuard().check(gold(4_000_000_000n, 0), undefined, now)).toEqual({
      kind: 'accepted',
    });
  });

  it('accepts a normal move', () => {
    expect(new QuoteGuard().check(gold(4_100_000_000n, 1), last, now)).toEqual({
      kind: 'accepted',
    });
  });

  it('ignores a quote that is not newer than the last one', () => {
    expect(new QuoteGuard().check(gold(4_100_000_000n, 0), last, now).kind).toBe('duplicate');
  });

  it('rejects non-positive prices and future timestamps', () => {
    const g = new QuoteGuard();
    expect(g.check(gold(0n, 1), last, now).kind).toBe('rejected');
    expect(g.check(quote('XAU', 4_000_000_000n, now.getTime() + 5 * 60_000), last, now)).toEqual({
      kind: 'rejected',
      reason: 'timestamp is in the future',
    });
  });

  it('holds back a single wild print', () => {
    const g = new QuoteGuard();
    const verdict = g.check(gold(8_000_000_000n, 1), last, now);
    expect(verdict).toEqual({ kind: 'quarantined', jumpPct: 100, pending: 1 });
    expect(g.quarantined()).toEqual(['XAU']);
    // The next normal quote clears it.
    expect(g.check(gold(4_010_000_000n, 2), last, now).kind).toBe('accepted');
    expect(g.quarantined()).toEqual([]);
  });

  it('accepts a big move once three distinct quotes confirm it', () => {
    const g = new QuoteGuard();
    expect(g.check(gold(4_400_000_000n, 1), last, now).kind).toBe('quarantined');
    expect(g.check(gold(4_410_000_000n, 2), last, now).kind).toBe('quarantined');
    expect(g.check(gold(4_405_000_000n, 3), last, now)).toEqual({
      kind: 'confirmed',
      jumpPct: 10.125,
    });
  });

  it('does not let one repeated bad print confirm itself', () => {
    const g = new QuoteGuard();
    const bad = gold(8_000_000_000n, 1);
    expect(g.check(bad, last, now).kind).toBe('quarantined');
    expect(g.check(bad, last, now).kind).toBe('duplicate');
    expect(g.check(bad, last, now).kind).toBe('duplicate');
    expect(g.quarantined()).toEqual(['XAU']);
  });

  it('does not confirm quotes that disagree with each other', () => {
    const g = new QuoteGuard();
    g.check(gold(4_400_000_000n, 1), last, now);
    g.check(gold(4_800_000_000n, 2), last, now);
    expect(g.check(gold(4_400_000_000n, 3), last, now).kind).toBe('quarantined');
  });

  it('uses per-metal thresholds: 9% is fine for nickel but not for gold', () => {
    const g = new QuoteGuard();
    const nickelLast = quote('NI', 15_500_000_000n, t(0));
    expect(g.check(quote('NI', 16_895_000_000n, t(1)), nickelLast, now).kind).toBe('accepted');
    expect(g.check(gold(4_360_000_000n, 1), last, now).kind).toBe('quarantined');
  });
});
