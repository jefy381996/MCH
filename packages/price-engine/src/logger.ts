import pino, { type Logger } from 'pino';
import type { Config } from './config.ts';

export function createLogger(config: Config): Logger {
  return pino({
    level: config.LOG_LEVEL,
    ...(config.LOG_PRETTY
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  });
}
