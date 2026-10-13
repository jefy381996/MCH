import { readFileSync } from 'node:fs';
import { parseBasket } from '@mch/index-core';
import { createAlerter } from './alerts.ts';
import { corsOrigins, loadConfig } from './config.ts';
import { PriceEngine } from './engine.ts';
import { QuoteGuard } from './guard.ts';
import { createLogger } from './logger.ts';
import { createOracleReader } from './oracle.ts';
import { buildServer } from './server.ts';
import { createPriceSource } from './sources/index.ts';
import { createPriceStore } from './store/index.ts';

const config = loadConfig();
const logger = createLogger(config);
const basket = parseBasket(JSON.parse(readFileSync(config.BASKET_FILE, 'utf8')));
const source = createPriceSource(config, basket);
const store = createPriceStore(config);
await store.init();

const engine = new PriceEngine({
  basket,
  source,
  store,
  guard: new QuoteGuard(),
  logger,
  alerter: createAlerter(logger, config.ALERT_WEBHOOK_URL),
  pollIntervalMs: config.POLL_INTERVAL_MS ?? source.defaultPollIntervalMs,
  backfillDays: source.isDemo ? config.DEMO_BACKFILL_DAYS : 0,
});

const app = await buildServer({
  basket,
  engine,
  store,
  source,
  oracle: await createOracleReader(config, basket),
  corsOrigins: corsOrigins(config),
  webDistDir: config.WEB_DIST_DIR,
  logger,
});

if (basket.isDemo || source.isDemo) {
  logger.warn('DEMO MODE: prices are simulated. Do not present them as market data.');
}
await engine.start();
await app.listen({ port: config.PORT, host: config.HOST });
logger.info(
  `MCH backend ready on http://localhost:${config.PORT} (store: ${store.kind}, source: ${source.id})`,
);

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info(`${signal} received, shutting down`);
  await engine.stop();
  await app.close();
  await store.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
