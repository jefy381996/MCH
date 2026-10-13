import {
  buildSnapshot,
  formatMicro,
  type Basket,
  type IndexSnapshot,
  type MetalId,
  type PriceQuote,
} from '@mch/index-core';
import type { FastifyBaseLogger } from 'fastify';
import type { Alerter } from './alerts.ts';
import type { QuoteGuard } from './guard.ts';
import type { PriceSource } from './sources/price-source.ts';
import type { PriceStore } from './store/price-store.ts';

export interface EngineHealth {
  startedAt: string | null;
  lastTickAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  quarantined: MetalId[];
}

export interface EngineOptions {
  basket: Basket;
  source: PriceSource;
  store: PriceStore;
  guard: QuoteGuard;
  logger: FastifyBaseLogger;
  alerter: Alerter;
  pollIntervalMs: number;
  /** Days of history to request from the source when the store is empty. */
  backfillDays: number;
  now?: () => Date;
}

/** Consecutive failed polls before raising a critical alert. */
const FAILURES_BEFORE_ALERT = 5;
const BACKFILL_STEP_MS = 60 * 60_000;

/**
 * The heartbeat of the backend: poll the source, vet each quote, store it,
 * recompute the index, tell subscribers. Missing or failing data never
 * produces an index; it produces an alert and the last good index stays up.
 */
export class PriceEngine {
  private readonly o: EngineOptions;
  private readonly now: () => Date;
  private readonly metals: MetalId[];
  private latest: Partial<Record<MetalId, PriceQuote>> = {};
  private readonly listeners = new Set<(s: IndexSnapshot) => void>();
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<IndexSnapshot | null> | undefined;
  private readonly state: EngineHealth = {
    startedAt: null,
    lastTickAt: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    lastError: null,
    quarantined: [],
  };

  constructor(options: EngineOptions) {
    this.o = options;
    this.now = options.now ?? (() => new Date());
    this.metals = options.basket.components.map((c) => c.metal);
  }

  async start(): Promise<void> {
    this.state.startedAt = this.now().toISOString();
    this.latest = await this.o.store.latestQuotes();
    this.o.source.resume?.(Object.values(this.latest));
    if (this.o.backfillDays > 0 && this.o.source.history && (await this.o.store.isEmpty())) {
      await this.backfill();
    }
    await this.tick();
    this.timer = setInterval(() => void this.tick(), this.o.pollIntervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.inFlight;
  }

  onSnapshot(listener: (s: IndexSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  health(): EngineHealth {
    return { ...this.state, quarantined: this.o.guard.quarantined() };
  }

  /** One poll. Overlapping calls share the in-flight poll rather than racing. */
  tick(): Promise<IndexSnapshot | null> {
    this.inFlight ??= this.poll().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async poll(): Promise<IndexSnapshot | null> {
    const now = this.now();
    this.state.lastTickAt = now.toISOString();
    let quotes: PriceQuote[];
    try {
      const timeout = AbortSignal.timeout(
        Math.min(30_000, Math.max(1_000, this.o.pollIntervalMs - 500)),
      );
      quotes = await this.o.source.fetchLatest(this.metals, timeout);
    } catch (err) {
      this.recordFailure(err);
      return null;
    }

    const accepted: PriceQuote[] = [];
    for (const quote of quotes) {
      if (!this.metals.includes(quote.metal)) continue;
      const verdict = this.o.guard.check(quote, this.latest[quote.metal], now);
      const price = formatMicro(quote.priceMicro, 2);
      switch (verdict.kind) {
        case 'accepted':
          accepted.push(quote);
          break;
        case 'confirmed':
          accepted.push(quote);
          this.o.alerter.alert(
            'warning',
            `${quote.metal} moved ${verdict.jumpPct.toFixed(2)}% and the move was confirmed`,
            {
              metal: quote.metal,
              price,
            },
          );
          break;
        case 'quarantined':
          this.o.alerter.alert(
            'warning',
            `${quote.metal} quote held back: jumped ${verdict.jumpPct.toFixed(2)}%`,
            {
              metal: quote.metal,
              price,
              pending: verdict.pending,
            },
          );
          break;
        case 'rejected':
          this.o.alerter.alert('warning', `${quote.metal} quote rejected: ${verdict.reason}`, {
            metal: quote.metal,
            price,
          });
          break;
        case 'duplicate':
          break;
      }
    }

    this.state.consecutiveFailures = 0;
    this.state.lastError = null;
    this.state.lastSuccessAt = now.toISOString();
    if (accepted.length === 0) return null;

    for (const q of accepted) this.latest[q.metal] = q;
    const missing = this.metals.filter((m) => !this.latest[m]);
    try {
      await this.o.store.saveQuotes(accepted);
      if (missing.length > 0) {
        this.o.logger.warn({ missing }, 'waiting for a first price for every basket metal');
        return null;
      }
      const snapshot = buildSnapshot(this.o.basket, this.latest, now);
      await this.o.store.saveSnapshots([snapshot]);
      for (const listener of this.listeners) listener(snapshot);
      return snapshot;
    } catch (err) {
      this.recordFailure(err);
      return null;
    }
  }

  private recordFailure(err: unknown): void {
    this.state.consecutiveFailures += 1;
    this.state.lastError = err instanceof Error ? err.message : String(err);
    const level = this.state.consecutiveFailures >= FAILURES_BEFORE_ALERT ? 'critical' : 'warning';
    this.o.alerter.alert(level, `price update failed: ${this.state.lastError}`, {
      consecutiveFailures: this.state.consecutiveFailures,
      source: this.o.source.id,
    });
  }

  private async backfill(): Promise<void> {
    const to = this.now();
    const from = new Date(to.getTime() - this.o.backfillDays * 24 * 3_600_000);
    const points = this.o.source.history!(this.metals, from, to, BACKFILL_STEP_MS);
    const quotes: PriceQuote[] = [];
    const snapshots: IndexSnapshot[] = [];
    for (const point of points) {
      const latest: Partial<Record<MetalId, PriceQuote>> = {};
      for (const q of point) latest[q.metal] = q;
      if (this.metals.some((m) => !latest[m])) continue;
      quotes.push(...point);
      snapshots.push(buildSnapshot(this.o.basket, latest, point[0]!.observedAt));
      this.latest = latest;
    }
    await this.o.store.saveQuotes(quotes);
    await this.o.store.saveSnapshots(snapshots);
    this.o.logger.info(
      { points: snapshots.length, days: this.o.backfillDays, source: this.o.source.id },
      'seeded empty database with price history',
    );
  }
}
