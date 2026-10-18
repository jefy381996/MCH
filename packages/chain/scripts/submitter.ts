/**
 * npm run chain:submitter
 *
 * Long-running process that keeps the on-chain index in step with the price
 * engine. Holds the operator key; run it separately from the web server.
 */
import { parseBasket, snapshotFromDTO, type IndexSnapshotDTO } from '@mch/index-core';
import { loadDeployment } from '../src/deployment.ts';
import { publishUpdate, readFeed } from '../src/oracle-ops.ts';
import { loadSeed } from '../src/secrets.ts';
import { DEFAULT_POLICY, OracleSubmitter } from '../src/submitter.ts';
import { connectOptionsFromEnv, connectOrExit, deploymentFileFromEnv, fail } from './env.ts';

const env = process.env;
const options = connectOptionsFromEnv();
const deployment = loadDeployment(deploymentFileFromEnv(options.network));
if (!deployment.oracle) {
  fail('This deployment has no price oracle yet, so there is nothing to keep up to date.');
}
const basket = parseBasket(deployment.oracle.basket);
const api = env.PRICE_API_URL ?? 'http://localhost:8080';
const intervalMs = Number(env.SUBMIT_INTERVAL_MS ?? 60_000);
const heartbeatMs = Number(env.HEARTBEAT_MINUTES ?? 60) * 60_000;
const policy = {
  deviationPct: Number(env.DEVIATION_PCT ?? DEFAULT_POLICY.deviationPct),
  heartbeatMs,
  staleAfterMs: 2 * heartbeatMs,
};

const lucid = await connectOrExit(options);
lucid.selectWallet.fromSeed(loadSeed('operator'));

const log = (level: string, obj: object, msg?: string) =>
  console.log(JSON.stringify({ level, time: new Date().toISOString(), msg, ...obj }));
const webhook = env.ALERT_WEBHOOK_URL;

const submitter = new OracleSubmitter({
  basket,
  policy,
  async fetchLatest() {
    const [index, health] = await Promise.all([
      fetch(new URL('/api/index', api)).then(
        (r) => r.json() as Promise<{ snapshot: IndexSnapshotDTO | null }>,
      ),
      fetch(new URL('/api/health', api)).then((r) => r.json() as Promise<{ status: string }>),
    ]);
    return {
      snapshot: index.snapshot ? snapshotFromDTO(index.snapshot) : null,
      healthy: health.status === 'ok',
    };
  },
  readFeed: async () => (await readFeed(lucid, deployment)).datum,
  publish: async (pricesMicro, now) =>
    (await publishUpdate(lucid, deployment, { pricesMicro, now })).txHash,
  awaitTx: (txHash) =>
    Promise.race([
      lucid.awaitTx(txHash),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5 * 60_000)),
    ]),
  alert(level, message) {
    log(level === 'critical' ? 'error' : 'warn', { alert: level }, message);
    if (webhook) {
      fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `[MCH oracle ${level.toUpperCase()}] ${message}` }),
      }).catch(() => {});
    }
  },
  logger: {
    info: (o, m) => log('info', o, m),
    warn: (o, m) => log('warn', o, m),
    error: (o, m) => log('error', o, m),
  },
  now: () => Date.now(),
});

log('info', { network: options.network, api, intervalMs, ...policy }, 'oracle submitter started');
submitter.start(intervalMs);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void submitter.stop().then(() => process.exit(0));
  });
}
