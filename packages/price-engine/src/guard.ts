import type { MetalId, PriceQuote } from '@mch/index-core';

/**
 * Protects the index from bad ticks ("fat fingers", provider glitches, unit
 * mix-ups) without blocking genuine market moves.
 *
 * A quote that jumps more than `maxJumpPct` from the last accepted price is
 * quarantined, not accepted. If the next few quotes agree with each other,
 * the move is real and the latest is accepted. A single wild print never
 * reaches the index, but a sustained new level does after a short delay.
 */

export interface GuardOptions {
  maxJumpPct: Record<MetalId, number>;
  /** Consecutive agreeing quotes needed to accept a big move. */
  confirmations: number;
  /** How closely those quotes must agree with each other. */
  confirmTolerancePct: number;
  /** Quotes timestamped further than this in the future are rejected. */
  maxFutureSkewMs: number;
}

export const DEFAULT_GUARD: GuardOptions = {
  maxJumpPct: { XAU: 5, XAG: 8, XPT: 8, NI: 10 },
  confirmations: 3,
  confirmTolerancePct: 1,
  maxFutureSkewMs: 2 * 60_000,
};

export type Verdict =
  | { kind: 'accepted' }
  | { kind: 'confirmed'; jumpPct: number }
  | { kind: 'duplicate' }
  | { kind: 'quarantined'; jumpPct: number; pending: number }
  | { kind: 'rejected'; reason: string };

/** |a - b| as a percentage of b, computed in integers to 6 decimal places. */
function pctDiff(a: bigint, b: bigint): number {
  const diff = a > b ? a - b : b - a;
  return Number((diff * 100_000_000n) / b) / 1_000_000;
}

export class QuoteGuard {
  private readonly pending = new Map<MetalId, PriceQuote[]>();
  private readonly options: GuardOptions;

  constructor(options: GuardOptions = DEFAULT_GUARD) {
    this.options = options;
  }

  check(quote: PriceQuote, last: PriceQuote | undefined, now: Date): Verdict {
    if (quote.priceMicro <= 0n) return { kind: 'rejected', reason: 'price is not positive' };
    if (quote.observedAt.getTime() > now.getTime() + this.options.maxFutureSkewMs) {
      return { kind: 'rejected', reason: 'timestamp is in the future' };
    }
    if (!last) return this.accept(quote);
    if (quote.observedAt.getTime() <= last.observedAt.getTime()) return { kind: 'duplicate' };

    const jumpPct = pctDiff(quote.priceMicro, last.priceMicro);
    if (jumpPct <= this.options.maxJumpPct[quote.metal]) return this.accept(quote);

    const held = this.pending.get(quote.metal) ?? [];
    const lastHeld = held[held.length - 1];
    // A provider repeating one bad print while the market is shut must not
    // count as confirmation. Only distinct, newer observations do.
    if (lastHeld && quote.observedAt.getTime() <= lastHeld.observedAt.getTime()) {
      return { kind: 'duplicate' };
    }
    const queue = [...held, quote].slice(-this.options.confirmations);
    this.pending.set(quote.metal, queue);
    if (queue.length >= this.options.confirmations && this.agree(queue)) {
      this.pending.delete(quote.metal);
      return { kind: 'confirmed', jumpPct };
    }
    return { kind: 'quarantined', jumpPct, pending: queue.length };
  }

  /** Metals currently holding back a suspicious move. */
  quarantined(): MetalId[] {
    return [...this.pending.keys()];
  }

  private accept(quote: PriceQuote): Verdict {
    this.pending.delete(quote.metal);
    return { kind: 'accepted' };
  }

  private agree(queue: PriceQuote[]): boolean {
    const newest = queue[queue.length - 1]!;
    return queue.every(
      (q) => pctDiff(q.priceMicro, newest.priceMicro) <= this.options.confirmTolerancePct,
    );
  }
}
