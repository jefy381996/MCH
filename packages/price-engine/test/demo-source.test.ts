import { computeIndexMicro, type MetalId } from '@mch/index-core';
import { describe, expect, it } from 'vitest';
import { DemoSource } from '../src/sources/demo-source.ts';
import { basket } from './fixtures.ts';

const metals: MetalId[] = ['XAU', 'XAG', 'XPT', 'NI'];

describe('DemoSource', () => {
  it('is clearly labelled as demo data', () => {
    const s = new DemoSource({ basket, seed: 1 });
    expect(s.isDemo).toBe(true);
    expect(s.label).toMatch(/not real market data/);
  });

  it('replays the same market for the same seed', async () => {
    let t = Date.parse('2026-10-13T12:00:00Z');
    const now = () => new Date(t);
    const a = new DemoSource({ basket, seed: 99, now });
    const b = new DemoSource({ basket, seed: 99, now });
    t += 60_000;
    expect(await a.fetchLatest(metals)).toEqual(await b.fetchLatest(metals));
  });

  it('moves prices over time and keeps them positive', async () => {
    let t = Date.parse('2026-10-13T12:00:00Z');
    const s = new DemoSource({ basket, seed: 5, speed: 1_000, now: () => new Date(t) });
    const first = await s.fetchLatest(metals);
    t += 3_600_000;
    const later = await s.fetchLatest(metals);
    expect(later.map((q) => q.priceMicro)).not.toEqual(first.map((q) => q.priceMicro));
    expect(later.every((q) => q.priceMicro > 0n)).toBe(true);
    expect(later[0]!.observedAt.getTime()).toBe(t);
  });

  it('builds history that ends exactly at the base prices (index 100 on the base date)', () => {
    const to = new Date('2026-10-13T12:00:00Z');
    const from = new Date(to.getTime() - 30 * 24 * 3_600_000);
    const s = new DemoSource({ basket, seed: 3, now: () => to });
    const points = s.history(metals, from, to, 3_600_000);
    expect(points).toHaveLength(30 * 24 + 1);
    expect(points[0]![0]!.observedAt).toEqual(from);
    const last = points[points.length - 1]!;
    expect(last[0]!.observedAt).toEqual(to);
    const prices = Object.fromEntries(last.map((q) => [q.metal, q.priceMicro]));
    expect(computeIndexMicro(basket, prices)).toBe(100_000_000n);
    // ...and somewhere along the way it actually moved.
    const firstIndex = computeIndexMicro(
      basket,
      Object.fromEntries(points[0]!.map((q) => [q.metal, q.priceMicro])),
    );
    expect(firstIndex).not.toBe(100_000_000n);
  });
});
