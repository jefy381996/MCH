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
export function loadSeed(
  role: Role,
  env: NodeJS.ProcessEnv = process.env,
  dir = SECRETS_DIR,
): string {
  const variable = `${role.toUpperCase()}_SEED`;
  const fromEnv = env[variable]?.trim();
  if (fromEnv) {
    if (!valid(fromEnv)) throw new Error(`${variable} is not a valid recovery phrase.`);
    return fromEnv;
  }
  const path = join(dir, `${role}.seed`);
  if (!existsSync(path)) {
    throw new Error(
      `No ${role} wallet in this folder (secrets/${role}.seed is missing). Nothing was sent.\n` +
        '  If you have not created your wallets yet, run `npm run chain:wallets`.\n' +
        '  If you already sent ADA to this wallet or created the coin, do NOT make a new one:\n' +
        `  put your 24 words from paper into secrets/${role}.seed, or ask me.`,
    );
  }
  const seed = readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(' ');
  if (!valid(seed)) {
    throw new Error(
      `secrets/${role}.seed is no longer a valid recovery phrase (it was probably changed while\n` +
        '  open in an editor). Nothing was sent. Do NOT delete it or run `npm run chain:wallets`:\n' +
        '  type the 24 words from your paper back into it, in order with one space between\n' +
        '  them, and save it.',
    );
  }
  return seed;
}

function valid(seed: string): boolean {
  try {
    walletFromSeed(seed, { network: 'Mainnet' });
    return true;
  } catch {
    return false;
  }
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
