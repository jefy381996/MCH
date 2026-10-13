import { describe, expect, it } from 'vitest';
import type { Basket } from '../src/basket.ts';
import { computeIndex, MissingPriceError, type PriceMap } from '../src/index-math.ts';
import type { MetalId } from '../src/metals.ts';
import vectors from './vectors.json' with { type: 'json' };

interface Vector {
  name: string;
  components: Array<{ metal: string; weightPpm: number; basePriceMicro: string }>;
  pricesMicro: Record<string, string>;
  expectedIndexMicro: string;
}

function basketOf(v: Vector): Basket {
  return {
    name: v.name,
    version: 1,
    baseDate: '2026-10-13',
    isDemo: true,
    components: v.components.map((c) => ({
      metal: c.metal as MetalId,
      weightPpm: c.weightPpm,
      basePriceMicro: BigInt(c.basePriceMicro),
    })),
  };
}

function pricesOf(v: Vector): PriceMap {
  return Object.fromEntries(Object.entries(v.pricesMicro).map(([k, p]) => [k, BigInt(p)]));
}

describe('shared test vectors (also run by the Aiken contract tests)', () => {
  it.each((vectors.cases as Vector[]).map((v) => [v.name, v] as const))('%s', (_name, v) => {
    expect(computeIndex(basketOf(v), pricesOf(v)).indexMicro).toBe(BigInt(v.expectedIndexMicro));
  });
});

/** Exact rational reference: round_half_up( SUM 100*w*p/b ), using a common denominator. */
function exactIndexMicro(basket: Basket, prices: PriceMap): bigint {
  let num = 0n;
  let den = 1n;
  for (const c of basket.components) {
    const n = 100n * BigInt(c.weightPpm) * prices[c.metal]!;
    const d = c.basePriceMicro;
    num = num * d + n * den;
    den = den * d;
  }
  return (2n * num + den) / (2n * den);
}

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('index rounding matches exact arithmetic', () => {
  it('agrees with an exact rational reference to within 1 micro-point on 20,000 random baskets', () => {
    const rand = rng(42);
    const metals: MetalId[] = ['XAU', 'XAG', 'XPT', 'NI'];
    let exactMatches = 0;
    const runs = 20_000;
    for (let i = 0; i < runs; i++) {
      const cuts = [rand(), rand(), rand()]
        .map((x) => Math.floor(x * 1_000_000))
        .sort((a, b) => a - b);
      const weights = [cuts[0]!, cuts[1]! - cuts[0]!, cuts[2]! - cuts[1]!, 1_000_000 - cuts[2]!];
      const components = metals
        .map((metal, j) => ({
          metal,
          weightPpm: weights[j]!,
          basePriceMicro: BigInt(1 + Math.floor(rand() * 50_000_000_000)),
        }))
        .filter((c) => c.weightPpm > 0);
      const basket: Basket = {
        name: 'r',
        version: 1,
        baseDate: '2026-10-13',
        isDemo: true,
        components,
      };
      const prices: PriceMap = {};
      for (const c of components) {
        const ratio = 0.01 + rand() * 10;
        prices[c.metal] = BigInt(1 + Math.floor(Number(c.basePriceMicro) * ratio));
      }
      const got = computeIndex(basket, prices).indexMicro;
      const exact = exactIndexMicro(basket, prices);
      const diff = got > exact ? got - exact : exact - got;
      expect(diff).toBeLessThanOrEqual(1n);
      if (diff === 0n) exactMatches++;
    }
    // Floor-then-round can only differ from exact rounding within ~4e-12 of a .5 boundary.
    expect(exactMatches).toBe(runs);
  });
});

describe('computeIndex', () => {
  const basket: Basket = basketOf(vectors.cases[0] as Vector);

  it('throws MissingPriceError naming the metal when a price is absent', () => {
    const prices = pricesOf(vectors.cases[0] as Vector);
    delete prices.XPT;
    expect(() => computeIndex(basket, prices)).toThrow(MissingPriceError);
    expect(() => computeIndex(basket, prices)).toThrow(/XPT/);
  });

  it('treats a zero price as missing rather than dividing the index down to nothing', () => {
    const prices = { ...pricesOf(vectors.cases[0] as Vector), NI: 0n };
    expect(() => computeIndex(basket, prices)).toThrow(/NI/);
  });

  it('reports per-metal contributions that add up to the index within rounding', () => {
    const v = vectors.cases[4] as Vector;
    const result = computeIndex(basketOf(v), pricesOf(v));
    const sum = result.components.reduce((acc, c) => acc + c.contributionMicro, 0n);
    const diff = sum > result.indexMicro ? sum - result.indexMicro : result.indexMicro - sum;
    expect(diff).toBeLessThanOrEqual(BigInt(result.components.length));
  });
});
