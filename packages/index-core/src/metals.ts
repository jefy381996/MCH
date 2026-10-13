/**
 * The metals MCH knows how to price. Adding a metal means adding an entry here;
 * whether it is in the basket is decided by the basket file, not by code.
 */

export const METAL_IDS = ['XAU', 'XAG', 'XPT', 'NI'] as const;
export type MetalId = (typeof METAL_IDS)[number];

export type PriceUnit = 'troy_oz' | 'tonne';

export interface MetalInfo {
  id: MetalId;
  name: string;
  unit: PriceUnit;
  /** Human label for the quote unit, e.g. "USD / troy oz". */
  unitLabel: string;
  /** Where the reference price for this metal is formed. */
  market: string;
  /** The official benchmark for this metal and who administers it. Licensed separately. */
  benchmark: string;
}

export const METALS: Readonly<Record<MetalId, MetalInfo>> = {
  XAU: {
    id: 'XAU',
    name: 'Gold',
    unit: 'troy_oz',
    unitLabel: 'USD / troy oz',
    market: 'London bullion market (LBMA)',
    benchmark: 'LBMA Gold Price, administered by ICE Benchmark Administration',
  },
  XAG: {
    id: 'XAG',
    name: 'Silver',
    unit: 'troy_oz',
    unitLabel: 'USD / troy oz',
    market: 'London bullion market (LBMA)',
    benchmark: 'LBMA Silver Price, administered by ICE Benchmark Administration',
  },
  XPT: {
    id: 'XPT',
    name: 'Platinum',
    unit: 'troy_oz',
    unitLabel: 'USD / troy oz',
    market: 'London platinum and palladium market (LPPM)',
    benchmark:
      'LBMA Platinum Price, administered by ICE Benchmark Administration (by the LME until 30 June 2026)',
  },
  NI: {
    id: 'NI',
    name: 'Nickel',
    unit: 'tonne',
    unitLabel: 'USD / tonne',
    market: 'London Metal Exchange (LME)',
    benchmark: 'LME Nickel Official Price, administered by the LME',
  },
};

export function isMetalId(value: unknown): value is MetalId {
  return typeof value === 'string' && (METAL_IDS as readonly string[]).includes(value);
}
