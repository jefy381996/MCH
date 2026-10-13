import type { Basket } from './basket.ts';
import type { MetalId } from './metals.ts';

/**
 * The MCH Index.
 *
 *   index = 100 x SUM_i( weight_i x price_i / basePrice_i )
 *
 * Each metal is measured as a ratio to its own base-date price, so quote units
 * (troy ounces vs tonnes) cancel out. The index is 100 on the base date.
 *
 * The result is an integer count of micro-points (index x 10^6). The exact
 * rounding below is part of the specification: the on-chain oracle validator
 * (contracts/lib/mch/index_math.ak) recomputes the index from the published
 * prices and rejects any update whose index differs by even one micro-point.
 * Change one, change both, and re-run the shared test vectors.
 */

/** Index value on the base date, in micro-points: 100.000000. */
export const INDEX_BASE_MICRO = 100_000_000n;

/** Extra precision carried through the sum before the single final rounding. */
export const INDEX_PRECISION = 1_000_000_000_000n;

export type PriceMap = Partial<Record<MetalId, bigint>>;

export interface ComponentResult {
  metal: MetalId;
  /** This metal's share of the index value, in micro-points. Sums (+-rounding) to the index. */
  contributionMicro: bigint;
}

export interface IndexResult {
  indexMicro: bigint;
  components: ComponentResult[];
}

export class MissingPriceError extends Error {
  readonly metal: MetalId;
  constructor(metal: MetalId) {
    super(`No usable price for ${metal}`);
    this.name = 'MissingPriceError';
    this.metal = metal;
  }
}

/**
 * One basket term at high precision: floor(100 * w * p * PRECISION / b).
 * All inputs are positive, so bigint truncation equals floor, which is what
 * Aiken's integer division does too.
 */
function term(weightPpm: number, price: bigint, basePrice: bigint): bigint {
  return (100n * BigInt(weightPpm) * price * INDEX_PRECISION) / basePrice;
}

/** Divide by INDEX_PRECISION, rounding half up. */
function roundOut(value: bigint): bigint {
  return (value + INDEX_PRECISION / 2n) / INDEX_PRECISION;
}

export function computeIndex(basket: Basket, prices: PriceMap): IndexResult {
  let total = 0n;
  const components: ComponentResult[] = [];
  for (const c of basket.components) {
    const price = prices[c.metal];
    if (price === undefined || price <= 0n) throw new MissingPriceError(c.metal);
    const t = term(c.weightPpm, price, c.basePriceMicro);
    total += t;
    components.push({ metal: c.metal, contributionMicro: roundOut(t) });
  }
  return { indexMicro: roundOut(total), components };
}

/** Convenience wrapper when only the number is needed. */
export function computeIndexMicro(basket: Basket, prices: PriceMap): bigint {
  return computeIndex(basket, prices).indexMicro;
}
