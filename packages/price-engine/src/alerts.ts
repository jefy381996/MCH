import type { FastifyBaseLogger } from 'fastify';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Alerter {
  alert(level: AlertLevel, message: string, details?: Record<string, unknown>): void;
}

/** The same message is sent to the webhook at most once per this window. */
const REPEAT_WINDOW_MS = 10 * 60_000;

/**
 * Logs every alert, and forwards warnings and criticals to a Slack-compatible
 * webhook if one is configured. Never throws: alerting must not take the
 * price feed down with it.
 */
export function createAlerter(
  logger: FastifyBaseLogger,
  webhookUrl?: string,
  now: () => number = Date.now,
): Alerter {
  const lastSent = new Map<string, number>();
  return {
    alert(level, message, details = {}) {
      const log =
        level === 'critical' ? logger.error : level === 'warning' ? logger.warn : logger.info;
      log.call(logger, { alert: level, ...details }, message);
      if (!webhookUrl || level === 'info') return;
      const t = now();
      if ((lastSent.get(message) ?? -Infinity) > t - REPEAT_WINDOW_MS) return;
      lastSent.set(message, t);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `[MCH ${level.toUpperCase()}] ${message}` }),
        signal: AbortSignal.timeout(5_000),
      }).catch((err: unknown) => logger.warn({ err }, 'alert webhook failed'));
    },
  };
}

export const silentAlerter: Alerter = { alert() {} };
