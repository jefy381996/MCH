import type { MetalId, PriceQuote } from '@mch/index-core';

/**
 * Anything that can tell us metal prices. The engine only ever talks to this
 * interface, so switching from demo data to a paid provider is a new class
 * plus one line in createPriceSource(), not a rewrite.
 */
export interface PriceSource {
  /** Stable id stored with every quote, e.g. "demo". */
  readonly id: string;
  /** Shown to website visitors next to every price. */
  readonly label: string;
  /** True for simulated data. The website shows a banner when it is. */
  readonly isDemo: boolean;
  /** Recommended polling interval for this provider's rate limits. */
  readonly defaultPollIntervalMs: number;

  /**
   * Latest available price for each requested metal. Return only metals the
   * provider actually has a price for; never invent one. `observedAt` must be
   * the provider's market timestamp, not the time of the request.
   */
  fetchLatest(metals: readonly MetalId[], signal?: AbortSignal): Promise<PriceQuote[]>;

  /**
   * Optional: price history used to seed an empty database, as one array of
   * quotes per point in time, oldest first.
   */
  history?(metals: readonly MetalId[], from: Date, to: Date, stepMs: number): PriceQuote[][];

  /**
   * Optional, for simulated sources only: continue from the last stored
   * prices after a restart instead of jumping back to the start.
   */
  resume?(latest: PriceQuote[]): void;
}

export class PriceSourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PriceSourceError';
  }
}
