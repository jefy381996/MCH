import { describe, expect, it } from 'vitest';
import { PriceEngine } from '../src/engine.ts';
import { QuoteGuard } from '../src/guard.ts';
import { DemoSource } from '../src/sources/demo-source.ts';
import { MemoryPriceStore } from '../src/store/memory-store.ts';
import {
  allAt,
  basket,
  quote,
  RecordingAlerter,
  ScriptedSource,
  silentLogger,
} from './fixtures.ts';

const T0 = Date.parse('2026-10-13T12:00:00Z');

function setup(source = new ScriptedSource(), backfillDays = 0) {
  let t = T0;
  const store = new MemoryPriceStore();
  const alerter = new RecordingAlerter();
  const engine = new PriceEngine({
    basket,
    source,
    store,
    guard: new QuoteGuard(),
    logger: silentLogger,
    alerter,
    pollIntervalMs: 60_000,
    backfillDays,
    now: () => new Date(t),
  });
  return { engine, store, alerter, source, advance: (ms: number) => (t += ms) };
}

describe('PriceEngine', () => {
  it('computes and publishes a snapshot when every metal has a price', async () => {
    const { engine, source, store } = setup();
    const seen: bigint[] = [];
    engine.onSnapshot((s) => seen.push(s.indexMicro));
    source.push(allAt(T0, { XAU: 1.1, XAG: 0.95, XPT: 1.02 }));
    const snap = await engine.tick();
    expect(snap?.indexMicro).toBe(101_750_000n);
    expect(seen).toEqual([101_750_000n]);
    expect((await store.latestSnapshot())?.indexMicro).toBe(101_750_000n);
  });

  it('never publishes an index while a basket metal has no price', async () => {
    const { engine, source } = setup();
    source.push(allAt(T0).filter((q) => q.metal !== 'NI'));
    expect(await engine.tick()).toBeNull();
    source.push([quote('NI', 15_500_000_000n, T0 + 1)]);
    expect((await engine.tick())?.indexMicro).toBe(100_000_000n);
  });

  it('does not create a new snapshot when nothing changed (market closed)', async () => {
    const { engine, source } = setup();
    source.push(allAt(T0)).push(allAt(T0));
    expect(await engine.tick()).not.toBeNull();
    expect(await engine.tick()).toBeNull();
    expect(engine.health().consecutiveFailures).toBe(0);
  });

  it('keeps a wild print out of the index and alerts', async () => {
    const { engine, source, alerter } = setup();
    source.push(allAt(T0)).push([quote('XAU', 40_000_000_000n, T0 + 60_000)]);
    await engine.tick();
    expect(await engine.tick()).toBeNull();
    expect(engine.health().quarantined).toEqual(['XAU']);
    expect(alerter.alerts.at(-1)?.message).toMatch(/XAU quote held back/);
  });

  it('counts failures, escalates to critical, and recovers', async () => {
    const { engine, source, alerter } = setup();
    for (let i = 0; i < 5; i++) source.push(new Error('provider down'));
    source.push(allAt(T0));
    for (let i = 0; i < 5; i++) expect(await engine.tick()).toBeNull();
    expect(engine.health().consecutiveFailures).toBe(5);
    expect(alerter.alerts.at(-1)).toEqual({
      level: 'critical',
      message: 'price update failed: provider down',
    });
    expect(await engine.tick()).not.toBeNull();
    expect(engine.health()).toMatchObject({ consecutiveFailures: 0, lastError: null });
  });

  it('shares one in-flight poll between overlapping ticks', async () => {
    const { engine, source } = setup();
    source.push(allAt(T0));
    const [a, b] = await Promise.all([engine.tick(), engine.tick()]);
    expect(a).toBe(b);
    expect(source.calls).toBe(1);
  });

  it('seeds an empty store from the source history, ending at index 100', async () => {
    const demo = new DemoSource({ basket, seed: 11, now: () => new Date(T0) });
    const { engine, store } = setup(demo as unknown as ScriptedSource, 2);
    await engine.start();
    await engine.stop();
    const history = await store.indexHistory(
      new Date(T0 - 3 * 24 * 3_600_000),
      new Date(T0),
      1_000,
    );
    expect(history.length).toBeGreaterThanOrEqual(48);
    expect(history.at(-1)?.indexMicro).toBe(100_000_000n);
  });

  it('does not backfill a store that already has data', async () => {
    const demo = new DemoSource({ basket, seed: 11, now: () => new Date(T0) });
    const { engine, store } = setup(demo as unknown as ScriptedSource, 2);
    await store.saveQuotes(allAt(T0 - 1_000));
    await engine.start();
    await engine.stop();
    expect(await store.earliestSnapshotAt()).toEqual(new Date(T0));
  });

  it('resumes a simulated source from the last stored prices after a restart', async () => {
    const demo = new DemoSource({ basket, seed: 11, now: () => new Date(T0) });
    const { engine, store } = setup(demo as unknown as ScriptedSource, 0);
    // A previous run left gold 30% above base: far beyond the guard's limit.
    await store.saveQuotes(allAt(T0 - 1_000, { XAU: 1.3 }));
    await engine.start();
    await engine.stop();
    expect(engine.health().quarantined).toEqual([]);
    const latest = await store.latestSnapshot();
    expect(latest?.components[0]?.priceMicro).toBe(5_200_000_000n);
  });
});
