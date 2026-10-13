import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSeedPhrase, walletFromSeed } from '@lucid-evolution/lucid';
import type { NetworkName } from './network.ts';

export type Role = 'admin' | 'operator';

export const SECRETS_DIR = fileURLToPath(new URL('../../../secrets/', import.meta.url));

/**
 * Seed phrase for a role: from ADMIN_SEED / OPERATOR_SEED if set (hosting
 * platforms), otherwise from secrets/<role>.seed (local, git-ignored).
 */
export function loadSeed(role: Role, env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env[`${role.toUpperCase()}_SEED`]?.trim();
  if (fromEnv) return fromEnv;
  const path = join(SECRETS_DIR, `${role}.seed`);
  if (!existsSync(path)) {
    throw new Error(
      `No ${role} wallet. Run \`npm run chain:wallets\` or set ${role.toUpperCase()}_SEED.`,
    );
  }
  return readFileSync(path, 'utf8').trim();
}

/** Creates secrets/<role>.seed if missing. Returns whether a new one was made. */
export function ensureSeed(role: Role): boolean {
  const path = join(SECRETS_DIR, `${role}.seed`);
  if (existsSync(path)) return false;
  mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(path, `${generateSeedPhrase()}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return true;
}

export function addressOf(seed: string, network: NetworkName): string {
  return walletFromSeed(seed, { network }).address;
}
