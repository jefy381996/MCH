import {
  buildSnapshot,
  parseBasket,
  type IndexSnapshot,
  type MetalId,
  type PriceQuote,
} from '@mch/index-core';
import { describe, expect, it } from 'vitest';
import type { OracleDatum } from '../src/codec.ts';
import { decide, DEFAULT_POLICY, OracleSubmitter, type SubmitterDeps } from '../src/submitter.ts';

const basket = parseBasket({
  name: 'Test',
  version: 1,
  baseDate: '2026-10-13',
  components: [
    { metal: 'XAU', weightPpm: 250_000, basePrice: '4000' },
    { metal: 'XAG', weightPpm: 250_000, basePrice: '48' },
    { metal: 'XPT', weightPpm: 250_000, basePrice: '1600' },
    { metal: 'NI', weightPpm: 250_000, basePrice: '15500' },
  ],
});
const T0 = Date.parse('2026-10-13T12:00:00Z');
const BASE: Record<MetalId, bigint> = {
  XAU: 4_000_000_000n,
  XAG: 48_000_000n,
  XPT: 1_600_000_000n,
  NI: 15_500_000_000n,
};

function snapshot(goldFactorPpm = 1_000_000n, at = T0): IndexSnapshot {
  const latest = Object.fromEntries(
    (Object.keys(BASE) as MetalId[]).map((m): [MetalId, PriceQuote] => [
      m,
      {
        metal: m,
        priceMicro: m === 'XAU' ? (BASE[m] * goldFactorPpm) / 1_000_000n : BASE[m],
        observedAt: new Date(at),
        source: 't',
      },
    ]),
  );
  return buildSnapshot(basket, latest, new Date(at));
}

const onChain = (o: Partial<OracleDatum> = {}): OracleDatum => ({
  indexMicro: 100_000_000n,
  pricesMicro: Object.values(BASE),
  publishedAt: T0 - 10 * 60_000,
  sequence: 7,
  basketVersion: 1,
  operator: 'ab',
  ...o,
});

describe('decide', () => {
  it('publishes when the index moved at least the threshold', () => {
    // Gold +2% -> index +0.5%
    expect(decide(DEFAULT_POLICY, snapshot(1_020_000n), onChain(), T0)).toEqual({
      publish: true,
      reason: 'deviation',
      deviationPct: 0.5,
    });
  });

  it('stays quiet for a small move inside the heartbeat window', () => {
    expect(decide(DEFAULT_POLICY, snapshot(1_010_000n), onChain(), T0)).toEqual({
      publish: false,
      deviationPct: 0.25,
    });
  });

  it('publishes on heartbeat even when nothing moved', () => {
    const d = decide(DEFAULT_POLICY, snapshot(), onChain({ publishedAt: T0 - 60 * 60_000 }), T0);
    expect(d).toMatchObject({ publish: true, reason: 'heartbeat' });
  });
});

function harness(over: Partial<SubmitterDeps> = {}) {
  const alerts: Array<{ level: string; message: string }> = [];
  const published: bigint[][] = [];
  const deps: SubmitterDeps = {
    basket,
    policy: DEFAULT_POLICY,
    fetchLatest: async () => ({ snapshot: snapshot(1_040_000n), healthy: true }),
    readFeed: async () => onChain(),
    publish: async (prices) => {
      published.push(prices);
      return 'tx1';
    },
    awaitTx: async () => true,
    alert: (level, message) => alerts.push({ level, message }),
    logger: { info() {}, warn() {}, error() {} },
    now: () => T0,
    ...over,
  };
  return { submitter: new OracleSubmitter(deps), alerts, published };
}

describe('OracleSubmitter', () => {
  it('publishes prices in basket order when the index moved', async () => {
    const { submitter, published } = harness();
    expect(await submitter.cycle()).toEqual({
      kind: 'published',
      txHash: 'tx1',
      reason: 'deviation',
    });
    expect(published).toEqual([[4_160_000_000n, 48_000_000n, 1_600_000_000n, 15_500_000_000n]]);
  });

  it('does not publish while the price engine is unhealthy', async () => {
    const { submitter, published, alerts } = harness({
      fetchLatest: async () => ({ snapshot: snapshot(1_040_000n), healthy: false }),
    });
    expect(await submitter.cycle()).toEqual({ kind: 'skipped', why: 'price engine unhealthy' });
    expect(published).toEqual([]);
    expect(alerts[0]?.level).toBe('warning');
  });

  it('refuses to sign a snapshot whose index does not match its prices', async () => {
    const tampered = snapshot(1_040_000n);
    tampered.indexMicro += 5n;
    const { submitter, published, alerts } = harness({
      fetchLatest: async () => ({ snapshot: tampered, healthy: true }),
    });
    expect(await submitter.cycle()).toMatchObject({
      kind: 'skipped',
      why: 'snapshot failed verification',
    });
    expect(published).toEqual([]);
    expect(alerts[0]).toMatchObject({ level: 'critical' });
  });

  it('refuses to publish across a basket version change', async () => {
    const { submitter, alerts } = harness({ readFeed: async () => onChain({ basketVersion: 2 }) });
    expect(await submitter.cycle()).toMatchObject({
      kind: 'skipped',
      why: 'basket version mismatch',
    });
    expect(alerts[0]?.message).toMatch(/new oracle deployment/);
  });

  it('raises a critical alert when the on-chain value is stale', async () => {
    const { alerts, submitter } = harness({
      readFeed: async () => onChain({ publishedAt: T0 - 3 * 3_600_000 }),
    });
    await submitter.cycle();
    expect(alerts).toContainEqual({
      level: 'critical',
      message: 'on-chain index is stale: last published 180 minutes ago',
    });
  });

  it('escalates repeated publish failures to critical, then recovers', async () => {
    let fail = true;
    const { submitter, alerts } = harness({
      publish: async () => {
        if (fail) throw new Error('node unreachable');
        return 'tx2';
      },
    });
    for (let i = 0; i < 3; i++) await submitter.cycle();
    expect(alerts.map((a) => a.level)).toEqual(['warning', 'warning', 'critical']);
    fail = false;
    expect(await submitter.cycle()).toMatchObject({ kind: 'published', txHash: 'tx2' });
  });

  it('reports an unconfirmed transaction as a failure', async () => {
    const { submitter } = harness({ awaitTx: async () => false });
    expect(await submitter.cycle()).toEqual({
      kind: 'failed',
      error: 'transaction tx1 did not confirm',
    });
  });
});
