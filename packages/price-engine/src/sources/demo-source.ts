import {
  microFromNumber,
  microToNumber,
  type Basket,
  type MetalId,
  type PriceQuote,
} from '@mch/index-core';
import type { PriceSource } from './price-source.ts';

const YEAR_MS = 365.25 * 24 * 3_600_000;

/** Rough annualised volatilities, so the simulation behaves like each metal. */
const ANNUAL_VOLATILITY: Record<MetalId, number> = {
  XAU: 0.16,
  XAG: 0.3,
  XPT: 0.28,
  NI: 0.35,
};

/** Deterministic PRNG so a given DEMO_SEED always replays the same market. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoSourceOptions {
  basket: Basket;
  seed?: number;
  /** Simulated market time passes this many times faster than real time. */
  speed?: number;
  now?: () => Date;
}

/**
 * Simulated prices: a geometric random walk starting at the basket's base
 * prices. Clearly labelled as demo data everywhere it appears. It exists so
 * the whole system can be built, shown and tested before a data licence is
 * bought; it must never be presented as market data.
 */
export class DemoSource implements PriceSource {
  readonly id = 'demo';
  readonly label = 'Demo data: simulated prices, not real market data';
  readonly isDemo = true;
  readonly defaultPollIntervalMs = 5_000;

  private readonly levels = new Map<MetalId, number>();
  private readonly random: () => number;
  private readonly speed: number;
  private readonly now: () => Date;
  private lastStepAt: number;

  constructor(options: DemoSourceOptions) {
    this.random = mulberry32(options.seed ?? Date.now());
    this.speed = options.speed ?? 60;
    this.now = options.now ?? (() => new Date());
    for (const c of options.basket.components) {
      this.levels.set(c.metal, microToNumber(c.basePriceMicro));
    }
    this.lastStepAt = this.now().getTime();
  }

  async fetchLatest(metals: readonly MetalId[]): Promise<PriceQuote[]> {
    const now = this.now();
    const elapsed = Math.max(0, now.getTime() - this.lastStepAt) * this.speed;
    this.lastStepAt = now.getTime();
    this.step(elapsed / YEAR_MS);
    return this.quotes(metals, now);
  }

  resume(latest: PriceQuote[]): void {
    for (const q of latest) {
      if (this.levels.has(q.metal)) this.levels.set(q.metal, microToNumber(q.priceMicro));
    }
  }

  /**
   * Simulated history in real time (speed 1). The path is walked backwards
   * from the current levels, so it ends exactly where the live feed starts:
   * at the base prices, with the index at 100 on the base date.
   */
  history(metals: readonly MetalId[], from: Date, to: Date, stepMs: number): PriceQuote[][] {
    const start = new Map(this.levels);
    const points: PriceQuote[][] = [];
    for (let t = to.getTime(); t >= from.getTime(); t -= stepMs) {
      if (t < to.getTime()) this.step(stepMs / YEAR_MS, -1);
      points.push(this.quotes(metals, new Date(t)));
    }
    for (const [metal, level] of start) this.levels.set(metal, level);
    this.lastStepAt = this.now().getTime();
    return points.reverse();
  }

  /** Advance (direction 1) or rewind (direction -1) the walk by `dtYears`. */
  private step(dtYears: number, direction: 1 | -1 = 1): void {
    if (dtYears <= 0) return;
    for (const [metal, level] of this.levels) {
      const sigma = ANNUAL_VOLATILITY[metal];
      const shock = sigma * Math.sqrt(dtYears) * this.gaussian() - 0.5 * sigma * sigma * dtYears;
      this.levels.set(metal, level * Math.exp(direction * shock));
    }
  }

  private quotes(metals: readonly MetalId[], at: Date): PriceQuote[] {
    return metals.flatMap((metal) => {
      const level = this.levels.get(metal);
      if (level === undefined) return [];
      return [{ metal, priceMicro: microFromNumber(level), observedAt: at, source: this.id }];
    });
  }

  /** Standard normal via Box-Muller. */
  private gaussian(): number {
    const u = Math.max(this.random(), Number.EPSILON);
    const v = this.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
