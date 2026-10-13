import { formatMicro, parseMicro } from './decimal.ts';
import { isMetalId, type MetalId } from './metals.ts';

/** Weights are parts-per-million and must sum to exactly this. */
export const WEIGHT_TOTAL_PPM = 1_000_000;
export const MAX_COMPONENTS = 8;

export interface BasketComponent {
  metal: MetalId;
  /** Share of the index, in parts per million. 250_000 = 25%. */
  weightPpm: number;
  /** Price on the base date, in micro-USD per the metal's unit. */
  basePriceMicro: bigint;
}

export interface Basket {
  name: string;
  /** Bump whenever weights or base prices change. Published on-chain with every update. */
  version: number;
  /** ISO date (YYYY-MM-DD) on which the index was 100. */
  baseDate: string;
  components: BasketComponent[];
  /** True when base prices are illustrative placeholders, not market data. */
  isDemo: boolean;
}

/** Returns every problem with a basket. An empty array means it is valid. */
export function validateBasket(basket: Basket): string[] {
  const errors: string[] = [];
  if (!basket.name.trim()) errors.push('name is empty');
  if (!Number.isInteger(basket.version) || basket.version < 1) {
    errors.push('version must be a positive integer');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(basket.baseDate) || Number.isNaN(Date.parse(basket.baseDate))) {
    errors.push('baseDate must be a valid YYYY-MM-DD date');
  }
  const n = basket.components.length;
  if (n === 0 || n > MAX_COMPONENTS) {
    errors.push(`basket must have 1..${MAX_COMPONENTS} components, has ${n}`);
  }
  const seen = new Set<MetalId>();
  let total = 0;
  for (const c of basket.components) {
    if (seen.has(c.metal)) errors.push(`${c.metal} appears more than once`);
    seen.add(c.metal);
    if (!Number.isInteger(c.weightPpm) || c.weightPpm <= 0) {
      errors.push(`${c.metal}: weightPpm must be a positive integer`);
    }
    if (c.basePriceMicro <= 0n) errors.push(`${c.metal}: basePrice must be positive`);
    total += c.weightPpm;
  }
  if (total !== WEIGHT_TOTAL_PPM) {
    errors.push(`weights sum to ${total} ppm, must be exactly ${WEIGHT_TOTAL_PPM}`);
  }
  return errors;
}

/** Shape of config/basket.json. Prices are decimal strings so nothing is lost to floats. */
export interface BasketFile {
  name: string;
  version: number;
  baseDate: string;
  isDemo?: boolean;
  components: Array<{ metal: string; weightPpm: number; basePrice: string }>;
}

export function parseBasket(raw: unknown): Basket {
  if (typeof raw !== 'object' || raw === null) throw new TypeError('basket must be an object');
  const file = raw as Partial<BasketFile>;
  if (!Array.isArray(file.components)) throw new TypeError('basket.components must be an array');
  const components = file.components.map((c, i): BasketComponent => {
    if (!isMetalId(c?.metal)) throw new TypeError(`components[${i}].metal is not a known metal`);
    if (typeof c.basePrice !== 'string') {
      throw new TypeError(`components[${i}].basePrice must be a decimal string`);
    }
    return { metal: c.metal, weightPpm: c.weightPpm, basePriceMicro: parseMicro(c.basePrice) };
  });
  const basket: Basket = {
    name: String(file.name ?? ''),
    version: Number(file.version),
    baseDate: String(file.baseDate ?? ''),
    isDemo: file.isDemo === true,
    components,
  };
  const errors = validateBasket(basket);
  if (errors.length > 0) throw new RangeError(`Invalid basket: ${errors.join('; ')}`);
  return basket;
}

export function serializeBasket(basket: Basket): BasketFile {
  return {
    name: basket.name,
    version: basket.version,
    baseDate: basket.baseDate,
    isDemo: basket.isDemo,
    components: basket.components.map((c) => ({
      metal: c.metal,
      weightPpm: c.weightPpm,
      basePrice: formatMicro(c.basePriceMicro),
    })),
  };
}
