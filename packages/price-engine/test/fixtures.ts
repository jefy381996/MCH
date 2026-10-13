import { parseBasket, type MetalId, type PriceQuote } from '@mch/index-core';
import pino from 'pino';
import type { Alerter, AlertLevel } from '../src/alerts.ts';
import type { PriceSource } from '../src/sources/price-source.ts';

export const basket = parseBasket({
  name: 'Test basket',
  version: 1,
  baseDate: '2026-10-13',
  isDemo: true,
  components: [
    { metal: 'XAU', weightPpm: 250_000, basePrice: '4000' },
    { metal: 'XAG', weightPpm: 250_000, basePrice: '48' },
    { metal: 'XPT', weightPpm: 250_000, basePrice: '1600' },
    { metal: 'NI', weightPpm: 250_000, basePrice: '15500' },
  ],
});

export const silentLogger = pino({ level: 'silent' });

export function quote(
  metal: MetalId,
  price: bigint,
  at: Date | number,
  source = 'test',
): PriceQuote {
  return { metal, priceMicro: price, observedAt: new Date(at), source };
}

export const BASE: Record<MetalId, bigint> = {
  XAU: 4_000_000_000n,
  XAG: 48_000_000n,
  XPT: 1_600_000_000n,
  NI: 15_500_000_000n,
};

/** A source that returns whatever the test queues up next. */
export class ScriptedSource implements PriceSource {
  readonly id = 'test';
  readonly label = 'Test source';
  readonly isDemo = false;
  readonly defaultPollIntervalMs = 60_000;
  private readonly queue: Array<PriceQuote[] | Error> = [];
  calls = 0;

  push(next: PriceQuote[] | Error): this {
    this.queue.push(next);
    return this;
  }

  async fetchLatest(): Promise<PriceQuote[]> {
    this.calls++;
    const next = this.queue.shift();
    if (next instanceof Error) throw next;
    return next ?? [];
  }
}

export function allAt(
  at: Date | number,
  scale: Partial<Record<MetalId, number>> = {},
): PriceQuote[] {
  return (Object.keys(BASE) as MetalId[]).map((m) => {
    const factor = scale[m] ?? 1;
    const price = (BASE[m] * BigInt(Math.round(factor * 1_000_000))) / 1_000_000n;
    return quote(m, price, at);
  });
}

export class RecordingAlerter implements Alerter {
  readonly alerts: Array<{ level: AlertLevel; message: string }> = [];
  alert(level: AlertLevel, message: string): void {
    this.alerts.push({ level, message });
  }
}
