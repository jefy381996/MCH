import { describe, expect, it } from 'vitest';
import { parseBasket } from '../src/basket.ts';
import { feedStatus } from '../src/freshness.ts';
import {
  buildSnapshot,
  snapshotFromDTO,
  snapshotToDTO,
  verifySnapshot,
  type PriceQuote,
} from '../src/snapshot.ts';
import type { MetalId } from '../src/metals.ts';

const basket = parseBasket({
  name: 'Test',
  version: 3,
  baseDate: '2026-10-13',
  components: [
    { metal: 'XAU', weightPpm: 250_000, basePrice: '4000' },
    { metal: 'XAG', weightPpm: 250_000, basePrice: '48' },
    { metal: 'XPT', weightPpm: 250_000, basePrice: '1600' },
    { metal: 'NI', weightPpm: 250_000, basePrice: '15500' },
  ],
});

const at = new Date('2026-10-13T12:00:00Z');
const q = (metal: MetalId, price: bigint): PriceQuote => ({
  metal,
  priceMicro: price,
  observedAt: at,
  source: 'test',
});

const latest = {
  XAU: q('XAU', 4_400_000_000n),
  XAG: q('XAG', 45_600_000n),
  XPT: q('XPT', 1_632_000_000n),
  NI: q('NI', 15_500_000_000n),
};

describe('buildSnapshot', () => {
  it('computes the index and keeps the exact inputs', () => {
    const s = buildSnapshot(basket, latest, at);
    expect(s.indexMicro).toBe(101_750_000n);
    expect(s.basketVersion).toBe(3);
    expect(s.components.map((c) => c.metal)).toEqual(['XAU', 'XAG', 'XPT', 'NI']);
    expect(s.components[0]?.contributionMicro).toBe(27_500_000n);
  });

  it('refuses to build when a basket metal has no price', () => {
    const { NI: _drop, ...partial } = latest;
    expect(() => buildSnapshot(basket, partial, at)).toThrow(/NI/);
  });
});

describe('DTO round trip', () => {
  it('survives JSON serialisation without losing a micro', () => {
    const s = buildSnapshot(basket, latest, at);
    const wire = JSON.parse(JSON.stringify(snapshotToDTO(s)));
    expect(snapshotFromDTO(wire)).toEqual(s);
    expect(wire.index).toBe('101.750000');
    expect(wire.changeSinceBasePct).toBe(1.75);
    expect(wire.components[1].changeSinceBasePct).toBe(-5);
  });
});

describe('verifySnapshot', () => {
  it('passes an honest snapshot', () => {
    expect(verifySnapshot(basket, buildSnapshot(basket, latest, at))).toEqual([]);
  });

  it('catches an index that does not match its own component prices', () => {
    const s = buildSnapshot(basket, latest, at);
    s.indexMicro += 1n;
    expect(verifySnapshot(basket, s).join()).toMatch(/does not match recomputed/);
  });

  it('catches a tampered weight or a basket version mismatch', () => {
    const s = buildSnapshot(basket, latest, at);
    s.components[0]!.weightPpm = 300_000;
    s.basketVersion = 2;
    const problems = verifySnapshot(basket, s);
    expect(problems.join()).toMatch(/basket version 2/);
    expect(problems.join()).toMatch(/XAU weight or base price/);
  });
});

describe('feedStatus', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  it.each([
    [0, 'live'],
    [15 * 60_000, 'live'],
    [15 * 60_000 + 1, 'delayed'],
    [2 * 3_600_000, 'delayed'],
    [2 * 3_600_000 + 1, 'closed'],
  ] as const)('age %i ms -> %s', (ageMs, expected) => {
    expect(feedStatus(new Date(now.getTime() - ageMs), now)).toBe(expected);
  });
});
