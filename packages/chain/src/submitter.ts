import { verifySnapshot, type Basket, type IndexSnapshot } from '@mch/index-core';
import type { OracleDatum } from './codec.ts';

/**
 * When to write to the chain. The classic push-oracle rule: publish when the
 * live index has moved enough to matter (deviation), or when it has been
 * quiet for long enough that readers need proof the feed is alive (heartbeat).
 */
export interface SubmitterPolicy {
  /** Publish when the live index differs from the on-chain one by at least this. */
  deviationPct: number;
  /** Publish at least this often, even when nothing moved. */
  heartbeatMs: number;
  /** Raise a critical alert if the on-chain value gets older than this. */
  staleAfterMs: number;
}

export const DEFAULT_POLICY: SubmitterPolicy = {
  deviationPct: 0.5,
  heartbeatMs: 60 * 60_000,
  staleAfterMs: 2 * 60 * 60_000,
};

export type Decision =
  | { publish: true; reason: 'deviation' | 'heartbeat'; deviationPct: number }
  | { publish: false; deviationPct: number };

export function decide(
  policy: SubmitterPolicy,
  snapshot: IndexSnapshot,
  onChain: OracleDatum,
  now: number,
): Decision {
  const diff = snapshot.indexMicro - onChain.indexMicro;
  const deviationPct =
    Number(((diff < 0n ? -diff : diff) * 100_000_000n) / onChain.indexMicro) / 1_000_000;
  if (deviationPct >= policy.deviationPct)
    return { publish: true, reason: 'deviation', deviationPct };
  if (now - onChain.publishedAt >= policy.heartbeatMs)
    return { publish: true, reason: 'heartbeat', deviationPct };
  return { publish: false, deviationPct };
}

export interface SubmitterLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface SubmitterDeps {
  basket: Basket;
  policy: SubmitterPolicy;
  /** Latest snapshot from the price engine, and whether the engine says it is healthy. */
  fetchLatest(): Promise<{ snapshot: IndexSnapshot | null; healthy: boolean }>;
  readFeed(): Promise<OracleDatum>;
  publish(pricesMicro: bigint[], now: number): Promise<string>;
  awaitTx(txHash: string): Promise<boolean>;
  alert(level: 'warning' | 'critical', message: string): void;
  logger: SubmitterLogger;
  now(): number;
}

export type CycleOutcome =
  | { kind: 'published'; txHash: string; reason: 'deviation' | 'heartbeat' }
  | { kind: 'skipped'; why: string }
  | { kind: 'failed'; error: string };

/** Consecutive failed publications before the alert becomes critical. */
const FAILURES_BEFORE_CRITICAL = 3;

/**
 * Keeps the on-chain feed in step with the price engine. Holds the operator
 * key, so it runs as its own process, separate from the public web server.
 * It re-verifies every snapshot before signing: a bug or compromise upstream
 * cannot get an inconsistent number on-chain, and the validator would reject
 * one anyway.
 */
export class OracleSubmitter {
  private readonly d: SubmitterDeps;
  private failures = 0;
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<CycleOutcome> | undefined;

  constructor(deps: SubmitterDeps) {
    this.d = deps;
  }

  start(intervalMs: number): void {
    void this.cycle();
    this.timer = setInterval(() => void this.cycle(), intervalMs);
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  cycle(): Promise<CycleOutcome> {
    this.running ??= this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(): Promise<CycleOutcome> {
    const { basket, policy, logger } = this.d;
    let latest: Awaited<ReturnType<SubmitterDeps['fetchLatest']>>;
    let onChain: OracleDatum;
    try {
      latest = await this.d.fetchLatest();
      onChain = await this.d.readFeed();
    } catch (err) {
      return this.fail(`could not read state: ${message(err)}`);
    }

    const now = this.d.now();
    if (now - onChain.publishedAt > policy.staleAfterMs) {
      const minutes = Math.round((now - onChain.publishedAt) / 60_000);
      this.d.alert('critical', `on-chain index is stale: last published ${minutes} minutes ago`);
    }
    if (!latest.healthy) {
      this.d.alert('warning', 'price engine reports unhealthy; not publishing');
      return { kind: 'skipped', why: 'price engine unhealthy' };
    }
    if (!latest.snapshot) return { kind: 'skipped', why: 'no index yet' };
    if (onChain.basketVersion !== basket.version) {
      this.d.alert(
        'critical',
        `basket version ${basket.version} differs from the on-chain feed (${onChain.basketVersion}); a basket change needs a new oracle deployment`,
      );
      return { kind: 'skipped', why: 'basket version mismatch' };
    }
    const problems = verifySnapshot(basket, latest.snapshot);
    if (problems.length > 0) {
      this.d.alert(
        'critical',
        `refusing to publish an inconsistent snapshot: ${problems.join('; ')}`,
      );
      return { kind: 'skipped', why: 'snapshot failed verification' };
    }

    const decision = decide(policy, latest.snapshot, onChain, now);
    if (!decision.publish) {
      return {
        kind: 'skipped',
        why: `deviation ${decision.deviationPct.toFixed(4)}% below threshold`,
      };
    }
    const prices = basket.components.map((c) => {
      const component = latest.snapshot!.components.find((x) => x.metal === c.metal);
      return component!.priceMicro; // verifySnapshot proved every metal is present
    });
    try {
      const txHash = await this.d.publish(prices, now);
      logger.info(
        { txHash, reason: decision.reason, deviationPct: decision.deviationPct },
        'submitted index update',
      );
      if (!(await this.d.awaitTx(txHash)))
        return this.fail(`transaction ${txHash} did not confirm`);
      this.failures = 0;
      return { kind: 'published', txHash, reason: decision.reason };
    } catch (err) {
      return this.fail(`publish failed: ${message(err)}`);
    }
  }

  private fail(error: string): CycleOutcome {
    this.failures += 1;
    this.d.alert(this.failures >= FAILURES_BEFORE_CRITICAL ? 'critical' : 'warning', error);
    this.d.logger.error({ consecutiveFailures: this.failures }, error);
    return { kind: 'failed', error };
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
