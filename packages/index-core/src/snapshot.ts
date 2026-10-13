import type { Basket } from './basket.ts';
import { formatMicro, parseMicro, percentChange } from './decimal.ts';
import { computeIndex, type PriceMap } from './index-math.ts';
import { isMetalId, type MetalId } from './metals.ts';

/** One price observation for one metal, as delivered by a data source. */
export interface PriceQuote {
  metal: MetalId;
  /** Micro-USD per the metal's unit. */
  priceMicro: bigint;
  /** When the market printed this price, per the provider. Not when we fetched it. */
  observedAt: Date;
  /** Id of the PriceSource that produced it, e.g. "demo". */
  source: string;
}

export interface SnapshotComponent {
  metal: MetalId;
  weightPpm: number;
  basePriceMicro: bigint;
  priceMicro: bigint;
  observedAt: Date;
  source: string;
  contributionMicro: bigint;
}

/** The index at one moment, with the exact inputs that produced it. */
export interface IndexSnapshot {
  indexMicro: bigint;
  computedAt: Date;
  basketVersion: number;
  components: SnapshotComponent[];
}

/** Builds a snapshot from the latest quote per metal. Throws if any basket metal is missing. */
export function buildSnapshot(
  basket: Basket,
  latest: Partial<Record<MetalId, PriceQuote>>,
  computedAt: Date,
): IndexSnapshot {
  const prices: PriceMap = {};
  for (const c of basket.components) {
    const q = latest[c.metal];
    if (q) prices[c.metal] = q.priceMicro;
  }
  const result = computeIndex(basket, prices);
  const components = basket.components.map((c, i): SnapshotComponent => {
    const q = latest[c.metal]!; // computeIndex already proved it exists
    return {
      metal: c.metal,
      weightPpm: c.weightPpm,
      basePriceMicro: c.basePriceMicro,
      priceMicro: q.priceMicro,
      observedAt: q.observedAt,
      source: q.source,
      contributionMicro: result.components[i]!.contributionMicro,
    };
  });
  return { indexMicro: result.indexMicro, computedAt, basketVersion: basket.version, components };
}

/* ------------------------------------------------------------------ */
/* Wire format. bigint is not JSON, so money travels as decimal text.  */
/* ------------------------------------------------------------------ */

export interface SnapshotComponentDTO {
  metal: MetalId;
  weightPpm: number;
  basePrice: string;
  price: string;
  observedAt: string;
  source: string;
  contribution: string;
  /** Display only. */
  changeSinceBasePct: number;
}

export interface IndexSnapshotDTO {
  index: string;
  computedAt: string;
  basketVersion: number;
  /** Display only. */
  changeSinceBasePct: number;
  components: SnapshotComponentDTO[];
}

export function snapshotToDTO(s: IndexSnapshot): IndexSnapshotDTO {
  return {
    index: formatMicro(s.indexMicro),
    computedAt: s.computedAt.toISOString(),
    basketVersion: s.basketVersion,
    changeSinceBasePct: percentChange(100_000_000n, s.indexMicro),
    components: s.components.map((c) => ({
      metal: c.metal,
      weightPpm: c.weightPpm,
      basePrice: formatMicro(c.basePriceMicro),
      price: formatMicro(c.priceMicro),
      observedAt: c.observedAt.toISOString(),
      source: c.source,
      contribution: formatMicro(c.contributionMicro),
      changeSinceBasePct: percentChange(c.basePriceMicro, c.priceMicro),
    })),
  };
}

export function snapshotFromDTO(dto: IndexSnapshotDTO): IndexSnapshot {
  return {
    indexMicro: parseMicro(dto.index),
    computedAt: new Date(dto.computedAt),
    basketVersion: dto.basketVersion,
    components: dto.components.map((c) => {
      if (!isMetalId(c.metal)) throw new TypeError(`Unknown metal ${String(c.metal)}`);
      return {
        metal: c.metal,
        weightPpm: c.weightPpm,
        basePriceMicro: parseMicro(c.basePrice),
        priceMicro: parseMicro(c.price),
        observedAt: new Date(c.observedAt),
        source: c.source,
        contributionMicro: parseMicro(c.contribution),
      };
    }),
  };
}

/**
 * Re-derives the index from a snapshot's own component prices and checks it
 * matches. The oracle submitter runs this before signing anything, so a bug or
 * tampering upstream cannot get an inconsistent number onto the chain.
 */
export function verifySnapshot(basket: Basket, s: IndexSnapshot): string[] {
  const problems: string[] = [];
  if (s.basketVersion !== basket.version) {
    problems.push(`basket version ${s.basketVersion} does not match ${basket.version}`);
  }
  const byMetal = new Map(s.components.map((c) => [c.metal, c]));
  for (const c of basket.components) {
    const got = byMetal.get(c.metal);
    if (!got) {
      problems.push(`missing component ${c.metal}`);
    } else if (got.weightPpm !== c.weightPpm || got.basePriceMicro !== c.basePriceMicro) {
      problems.push(`${c.metal} weight or base price differs from the basket`);
    }
  }
  if (s.components.length !== basket.components.length) {
    problems.push('component count differs from the basket');
  }
  if (problems.length > 0) return problems;
  const prices: PriceMap = Object.fromEntries(s.components.map((c) => [c.metal, c.priceMicro]));
  const expected = computeIndex(basket, prices).indexMicro;
  if (expected !== s.indexMicro) {
    problems.push(`index ${s.indexMicro} does not match recomputed ${expected}`);
  }
  return problems;
}
