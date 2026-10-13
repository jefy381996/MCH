import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Loads the repository's .env if there is one. Variables already set in the
 * real environment win. Done here rather than with `node --env-file`, which
 * crashes in watch mode when the file does not exist (a fresh clone).
 */
export function loadDotEnv(path = fileURLToPath(new URL('../../../.env', import.meta.url))): void {
  if (existsSync(path)) process.loadEnvFile(path);
}
