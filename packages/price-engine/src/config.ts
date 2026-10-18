import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const fromHere = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/** The repository root. Relative paths in .env are read from here, whatever folder npm runs in. */
export const REPO_ROOT = fromHere('../../../');
const repoPath = z.string().transform((p) => resolve(REPO_ROOT, p));

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Human-readable logs for local development. */
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  BASKET_FILE: repoPath.default(fromHere('../../../config/basket.json')),

  /** Only "demo" exists until a paid provider is chosen; see docs/DATA-PROVIDERS.md. */
  PRICE_SOURCE: z.enum(['demo']).default('demo'),
  /** Defaults to 5 s for the demo source, 60 s for real providers. */
  POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).optional(),
  DEMO_SEED: z.coerce.number().int().optional(),
  /** How many times faster than real life the demo market moves. */
  DEMO_SPEED: z.coerce.number().positive().default(60),
  /** Days of simulated history to create when the database is empty. */
  DEMO_BACKFILL_DAYS: z.coerce.number().int().min(0).max(365).default(30),

  /** Unset: prices are kept in memory and lost on restart. Fine for trying it out. */
  DATABASE_URL: z.string().optional(),

  WEB_DIST_DIR: repoPath.default(fromHere('../../web/dist')),
  /** Comma-separated origins allowed to call the API from a browser. Same-origin always works. */
  CORS_ORIGINS: z.string().optional(),
  /** Slack-compatible incoming webhook for operational alerts. */
  ALERT_WEBHOOK_URL: z.string().optional(),

  /** JSON written by `npm run chain:deploy`; enables the on-chain oracle panel. */
  ORACLE_DEPLOYMENT_FILE: repoPath.optional(),
  CARDANO_PROVIDER: z.enum(['koios', 'blockfrost']).default('koios'),
  BLOCKFROST_PROJECT_ID: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Treat `FOO=` in a .env file as "not set" rather than as an empty value.
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  return parsed.data;
}

export function corsOrigins(config: Config): string[] {
  return (config.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
