import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { PriceEngine } from '../src/engine.ts';
import { QuoteGuard } from '../src/guard.ts';
import { buildServer } from '../src/server.ts';
import type { OracleReader, OracleStatus } from '../src/oracle-reader.ts';
import { MemoryPriceStore } from '../src/store/memory-store.ts';
import { allAt, basket, RecordingAlerter, ScriptedSource, silentLogger } from './fixtures.ts';

const T0 = Date.parse('2026-10-13T12:00:00Z');
const DAY = 24 * 3_600_000;

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function setup(options: { webDistDir?: string; oracle?: OracleReader } = {}) {
  let t = T0;
  const now = () => new Date(t);
  const source = new ScriptedSource();
  const store = new MemoryPriceStore();
  const engine = new PriceEngine({
    basket,
    source,
    store,
    guard: new QuoteGuard(),
    logger: silentLogger,
    alerter: new RecordingAlerter(),
    pollIntervalMs: 60_000,
    backfillDays: 0,
    now,
  });
  app = await buildServer({ basket, engine, store, source, now, ...options });
  return { app, engine, source, store, advance: (ms: number) => (t += ms) };
}

describe('GET /api/index', () => {
  it('says "waiting" before the first price', async () => {
    const { app } = await setup();
    const body = (await app.inject('/api/index')).json();
    expect(body).toMatchObject({ snapshot: null, status: 'waiting', change24hPct: null });
    expect(body.dataSource).toEqual({ id: 'test', label: 'Test source', isDemo: false });
  });

  it('returns the index, per-metal freshness and 24h change', async () => {
    const { app, engine, source, advance } = await setup();
    // Moves stay inside the guard's per-metal limits, so all are accepted.
    source.push(allAt(T0)).push(allAt(T0 + DAY, { XAU: 1.04, XAG: 1.05, XPT: 1.02, NI: 1.06 }));
    await engine.tick();
    advance(DAY);
    await engine.tick();
    const body = (await app.inject('/api/index')).json();
    expect(body.snapshot.index).toBe('104.250000');
    expect(body.status).toBe('live');
    expect(body.componentStatus).toEqual({ XAU: 'live', XAG: 'live', XPT: 'live', NI: 'live' });
    expect(body.change24hPct).toBe(4.25);
  });

  it('reports "closed" once every price is more than two hours old', async () => {
    const { app, engine, source, advance } = await setup();
    source.push(allAt(T0));
    await engine.tick();
    advance(3 * 3_600_000);
    expect((await app.inject('/api/index')).json().status).toBe('closed');
  });
});

describe('GET /api/index/history', () => {
  it('validates the range', async () => {
    const { app } = await setup();
    const res = await app.inject('/api/index/history?range=2w');
    expect(res.statusCode).toBe(400);
  });

  it('returns points as decimal strings', async () => {
    const { app, engine, source, advance } = await setup();
    // 12 hours apart, so they land in different buckets of a 1-day chart.
    source.push(allAt(T0)).push(allAt(T0 + 12 * 3_600_000, { XAU: 1.04 }));
    await engine.tick();
    advance(12 * 3_600_000);
    await engine.tick();
    const body = (await app.inject('/api/index/history?range=1d')).json();
    expect(body.points.map((p: { index: string }) => p.index)).toEqual([
      '100.000000',
      '101.000000',
    ]);
    expect(body.points[1].prices).toEqual({
      XAU: '4160.000000',
      XAG: '48.000000',
      XPT: '1600.000000',
      NI: '15500.000000',
    });
  });
});

describe('other endpoints', () => {
  it('serves the basket and methodology', async () => {
    const { app } = await setup();
    const body = (await app.inject('/api/basket')).json();
    expect(body.basket.components).toHaveLength(4);
    expect(body.metals.map((m: { name: string }) => m.name)).toEqual([
      'Gold',
      'Silver',
      'Platinum',
      'Nickel',
    ]);
  });

  it('reports the oracle as not configured', async () => {
    const { app } = await setup();
    expect((await app.inject('/api/oracle')).json()).toEqual({ configured: false, status: null });
  });

  it('reports health and degrades after repeated failures', async () => {
    const { app, engine, source } = await setup();
    source.push(allAt(T0));
    await engine.tick();
    expect((await app.inject('/api/health')).json().status).toBe('ok');
    for (let i = 0; i < 5; i++) source.push(new Error('down'));
    for (let i = 0; i < 5; i++) await engine.tick();
    expect((await app.inject('/api/health')).json().status).toBe('degraded');
  });

  it('sets security headers', async () => {
    const { app } = await setup();
    const res = await app.inject('/api/index');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  });

  it('returns JSON 404 for unknown API paths', async () => {
    const { app } = await setup();
    const res = await app.inject('/api/nope');
    expect(res.statusCode).toBe(404);
  });
});

describe('WebSocket /api/stream', () => {
  it('sends the current index on connect and pushes each new snapshot', async () => {
    const { app, engine, source, advance } = await setup();
    source.push(allAt(T0)).push(allAt(T0 + 60_000, { XAU: 1.04 }));
    await engine.tick();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;

    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/stream`);
    const messages: Array<{ type: string; data: { snapshot: { index: string } } }> = [];
    const received = (n: number) =>
      new Promise<void>((resolve) => {
        const check = () => (messages.length >= n ? resolve() : setTimeout(check, 10));
        check();
      });
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));

    await received(1);
    expect(messages[0]).toMatchObject({
      type: 'index',
      data: { snapshot: { index: '100.000000' } },
    });

    advance(60_000);
    await engine.tick();
    await received(2);
    expect(messages[1]?.data.snapshot.index).toBe('101.000000');
    ws.close();
  });
});

describe('GET /api/oracle with a deployment', () => {
  const status: OracleStatus = {
    network: 'Preprod',
    policyId: 'ab'.repeat(28),
    scriptAddress: 'addr_test1wz',
    index: '101.750000',
    prices: { XAU: '4400.000000' },
    publishedAt: '2026-10-13T12:00:00.000Z',
    sequence: 3,
    basketVersion: 1,
    txHash: 'cd'.repeat(32),
    explorerUrl: 'https://preprod.cardanoscan.io/transaction/x',
    token: null,
  };

  it('serves the on-chain state and caches it', async () => {
    let reads = 0;
    const { app } = await setup({ oracle: { read: async () => (reads++, status) } });
    expect((await app.inject('/api/oracle')).json()).toEqual({ configured: true, status });
    await app.inject('/api/oracle');
    expect(reads).toBe(1);
  });

  it('degrades gracefully when the chain is unreachable', async () => {
    const { app } = await setup({
      oracle: {
        read: async () => {
          throw new Error('koios down');
        },
      },
    });
    const res = await app.inject('/api/oracle');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ configured: true, status: null, error: 'chain unavailable' });
  });
});

describe('serving the website', () => {
  function site() {
    const dir = mkdtempSync(join(tmpdir(), 'mch-web-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>MCH</title>');
    writeFileSync(join(dir, 'assets', 'app-1.js'), 'console.log(1)');
    return dir;
  }

  it('serves the page, its assets and client-side routes', async () => {
    const { app } = await setup({ webDistDir: site() });
    expect((await app.inject('/')).body).toContain('<title>MCH</title>');
    const js = await app.inject('/assets/app-1.js');
    expect(js.headers['content-type']).toMatch(/javascript/);
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await app.inject('/some/page')).body).toContain('<title>MCH</title>');
  });

  it('answers a missing asset with 404, not with the HTML page', async () => {
    const { app } = await setup({ webDistDir: site() });
    const res = await app.inject('/assets/missing.js');
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('serves files added after start-up (a rebuilt site needs no restart)', async () => {
    const dir = site();
    const { app } = await setup({ webDistDir: dir });
    await app.ready();
    writeFileSync(join(dir, 'assets', 'app-2.js'), 'console.log(2)');
    const res = await app.inject('/assets/app-2.js');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('console.log(2)');
  });
});
