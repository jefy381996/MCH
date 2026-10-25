import { existsSync } from 'node:fs';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import {
  DEFAULT_FRESHNESS,
  feedStatus,
  formatMicro,
  METALS,
  percentChange,
  serializeBasket,
  snapshotToDTO,
  type Basket,
  type FeedStatus,
  type IndexSnapshot,
  type IndexSnapshotDTO,
  type MetalId,
} from '@mch/index-core';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { PriceEngine } from './engine.ts';
import type { OracleReader, OracleStatus, TokenInfo } from './oracle-reader.ts';
import type { PriceSource } from './sources/price-source.ts';
import type { PriceStore } from './store/price-store.ts';

export interface ServerOptions {
  basket: Basket;
  engine: PriceEngine;
  store: PriceStore;
  source: PriceSource;
  oracle?: OracleReader;
  corsOrigins?: string[];
  webDistDir?: string;
  logger?: FastifyBaseLogger;
  now?: () => Date;
  /** Shown on the About and legal pages when set. */
  site?: { operator?: string; contactEmail?: string };
}

export interface SitePayload {
  operator: string | null;
  contactEmail: string | null;
}

/** Everything the dashboard needs in one payload. Also pushed over the WebSocket. */
export interface IndexPayload {
  snapshot: IndexSnapshotDTO | null;
  status: FeedStatus | 'waiting';
  componentStatus: Partial<Record<MetalId, FeedStatus>>;
  change24hPct: number | null;
  dataSource: { id: string; label: string; isDemo: boolean };
  serverTime: string;
}

/** The chain as the website sees it: the coin, and the oracle feed once it exists. */
export interface OraclePayload {
  configured: boolean;
  network: string | null;
  token: TokenInfo | null;
  oracleDeployed: boolean;
  status: OracleStatus | null;
  error?: string;
}

const RANGES_MS = {
  '1d': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
  '90d': 90 * 24 * 3_600_000,
  '1y': 365 * 24 * 3_600_000,
} as const;
type Range = keyof typeof RANGES_MS | 'all';
const HISTORY_POINTS = 240;
const ORACLE_CACHE_MS = 30_000;

const STATUS_RANK: Record<FeedStatus, number> = { live: 0, delayed: 1, closed: 2 };

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'",
};

export async function buildServer(o: ServerOptions): Promise<FastifyInstance> {
  const now = o.now ?? (() => new Date());
  const app = Fastify({
    ...(o.logger ? { loggerInstance: o.logger } : { logger: false }),
    trustProxy: true,
    // Fastify's own request log records visitors' IP addresses; this site keeps none.
    disableRequestLogging: true,
  });
  app.addHook('onResponse', async (req, reply) => {
    req.log.info(
      {
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
      'request',
    );
  });

  await app.register(cors, {
    origin: o.corsOrigins && o.corsOrigins.length > 0 ? o.corsOrigins : false,
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: (req) => !req.url.startsWith('/api/'),
  });
  await app.register(websocket);
  app.addHook('onSend', async (_req, reply, payload) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) reply.header(k, v);
    return payload;
  });

  async function indexPayload(snapshot?: IndexSnapshot | null): Promise<IndexPayload> {
    const latest = snapshot === undefined ? await o.store.latestSnapshot() : snapshot;
    const t = now();
    const componentStatus: Partial<Record<MetalId, FeedStatus>> = {};
    let status: IndexPayload['status'] = 'waiting';
    let change24hPct: number | null = null;
    if (latest) {
      for (const c of latest.components) {
        componentStatus[c.metal] = feedStatus(c.observedAt, t, DEFAULT_FRESHNESS);
      }
      // The feed is as live as its freshest component.
      status = Object.values(componentStatus).reduce<FeedStatus>(
        (best, s) => (STATUS_RANK[s] < STATUS_RANK[best] ? s : best),
        'closed',
      );
      const dayAgo = await o.store.snapshotAtOrBefore(
        new Date(latest.computedAt.getTime() - RANGES_MS['1d']),
      );
      if (dayAgo) change24hPct = percentChange(dayAgo.indexMicro, latest.indexMicro);
    }
    return {
      snapshot: latest ? snapshotToDTO(latest) : null,
      status,
      componentStatus,
      change24hPct,
      dataSource: { id: o.source.id, label: o.source.label, isDemo: o.source.isDemo },
      serverTime: t.toISOString(),
    };
  }

  app.get('/api/health', async () => {
    const engine = o.engine.health();
    const healthy = engine.consecutiveFailures < 5 && engine.lastSuccessAt !== null;
    return {
      status: healthy ? 'ok' : 'degraded',
      store: o.store.kind,
      engine,
      serverTime: now().toISOString(),
    };
  });

  app.get('/api/index', async () => indexPayload());

  app.get<{ Querystring: { range?: string } }>('/api/index/history', async (req, reply) => {
    const range = (req.query.range ?? '30d') as Range;
    if (range !== 'all' && !(range in RANGES_MS)) {
      return reply
        .code(400)
        .send({ error: `range must be one of ${Object.keys(RANGES_MS).join(', ')}, all` });
    }
    const to = now();
    const from =
      range === 'all'
        ? ((await o.store.earliestSnapshotAt()) ?? to)
        : new Date(to.getTime() - RANGES_MS[range]);
    const points = await o.store.indexHistory(from, to, HISTORY_POINTS);
    return {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      points: points.map((p) => ({
        t: p.at.toISOString(),
        index: formatMicro(p.indexMicro),
        prices: Object.fromEntries(
          Object.entries(p.pricesMicro).map(([metal, price]) => [metal, formatMicro(price!)]),
        ),
      })),
    };
  });

  app.get('/api/site', async (): Promise<SitePayload> => ({
    operator: o.site?.operator?.trim() || null,
    contactEmail: o.site?.contactEmail?.trim() || null,
  }));

  app.get('/api/basket', async () => ({
    basket: serializeBasket(o.basket),
    metals: o.basket.components.map((c) => METALS[c.metal]),
    methodology: {
      formula: 'index = 100 x SUM( weight x price / basePrice )',
      precision: 'Integer arithmetic in micro-units; rounded half-up to 6 decimal places.',
    },
  }));

  let oracleCache: { at: number; value: OracleStatus | null } | undefined;
  app.get('/api/oracle', async (): Promise<OraclePayload> => {
    if (!o.oracle) {
      return { configured: false, network: null, token: null, oracleDeployed: false, status: null };
    }
    const base = {
      configured: true,
      network: o.oracle.network,
      token: o.oracle.token,
      oracleDeployed: o.oracle.hasOracle,
    };
    if (!o.oracle.hasOracle) return { ...base, status: null };
    const t = Date.now();
    if (!oracleCache || t - oracleCache.at > ORACLE_CACHE_MS) {
      try {
        oracleCache = { at: t, value: await o.oracle.read() };
      } catch (err) {
        app.log.warn({ err }, 'could not read on-chain oracle');
        return { ...base, status: oracleCache?.value ?? null, error: 'chain unavailable' };
      }
    }
    return { ...base, status: oracleCache.value };
  });

  // Live updates: the current payload on connect, then one per new snapshot.
  const sockets = new Set<WebSocket>();
  app.get('/api/stream', { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));
    void indexPayload().then((payload) => {
      if (socket.readyState === socket.OPEN)
        socket.send(JSON.stringify({ type: 'index', data: payload }));
    });
  });
  const unsubscribe = o.engine.onSnapshot((snapshot) => {
    if (sockets.size === 0) return;
    void indexPayload(snapshot).then((payload) => {
      const message = JSON.stringify({ type: 'index', data: payload });
      for (const s of sockets) if (s.readyState === s.OPEN) s.send(message);
    });
  });
  const keepAlive = setInterval(() => {
    for (const s of sockets) if (s.readyState === s.OPEN) s.ping();
  }, 30_000);
  keepAlive.unref();
  app.addHook('onClose', async () => {
    unsubscribe();
    clearInterval(keepAlive);
    for (const s of sockets) s.close(1001, 'server shutting down');
  });

  // The built website, if present. Files are looked up per request, so a
  // rebuilt site is served without a restart. Page-like paths (no file
  // extension) fall back to index.html for client-side routes; a missing
  // asset is a real 404, never HTML pretending to be JavaScript.
  if (o.webDistDir && existsSync(o.webDistDir)) {
    await app.register(fastifyStatic, {
      root: o.webDistDir,
      setHeaders(reply, filePath) {
        reply.header(
          'cache-control',
          /[\\/]assets[\\/]/.test(filePath) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
    app.setNotFoundHandler((req, reply) => {
      const path = req.url.split('?')[0] ?? '';
      const isPage =
        req.method === 'GET' && !path.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(path);
      if (isPage) return reply.header('cache-control', 'no-cache').sendFile('index.html');
      return reply.code(404).send({ error: 'not found' });
    });
  } else {
    app.get('/', async () => ({
      message:
        'MCH API is running. Website not built yet: run `npm run build`, or use `npm run dev`.',
      endpoints: [
        '/api/index',
        '/api/index/history?range=30d',
        '/api/basket',
        '/api/oracle',
        '/api/health',
      ],
    }));
  }

  return app;
}
