import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LucidEvolution } from '@lucid-evolution/lucid';
import { connect, isNetworkName, type ConnectOptions, type NetworkName } from '../src/network.ts';

// Every chain script imports this module first, so .env is loaded before
// anything reads process.env. Real environment variables win.
const dotEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(dotEnv)) {
  const twice = repeatedKeys(readFileSync(dotEnv, 'utf8'));
  if (twice.length > 0) {
    // The last copy silently wins, so a pasted block can leave the old values in force.
    fail(
      `.env has more than one ${twice.map((k) => `${k}=`).join(', ')} line. Only the last one counts,\n` +
        '  which is easy to miss. Delete the extra lines, keeping the ones you want, and save the file.',
    );
  }
  process.loadEnvFile(dotEnv);
}

/** Settings set on more than one (uncommented) line of a .env file. */
export function repeatedKeys(text: string): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (!key) continue;
    if (seen.has(key)) twice.add(key);
    seen.add(key);
  }
  return [...twice];
}

/** Network and provider settings shared by every chain script. */
export function connectOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): ConnectOptions {
  // Any capitalisation: "mainnet" in .env means Mainnet.
  const raw = env.CARDANO_NETWORK?.trim() || 'Preprod';
  const network = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (!isNetworkName(network))
    fail(`CARDANO_NETWORK in .env must be Preprod, Preview or Mainnet, not "${raw}".`);
  const provider = env.CARDANO_PROVIDER?.trim().toLowerCase() || 'koios';
  if (provider !== 'koios' && provider !== 'blockfrost') {
    fail(`CARDANO_PROVIDER in .env must be koios or blockfrost, not "${env.CARDANO_PROVIDER}".`);
  }
  return { network, provider, blockfrostProjectId: env.BLOCKFROST_PROJECT_ID };
}

/** The repository's root folder, as a real file path on every OS (Windows included). */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** A path from .env or the command line: relative paths are taken from the repository root. */
export function repoPath(path: string): string {
  return resolve(REPO_ROOT, path);
}

export function defaultDeploymentFile(network: NetworkName): string {
  return repoPath(join('deployments', `${network.toLowerCase()}.json`));
}

/** The deployment record for this network: DEPLOYMENT_FILE if set, else deployments/<network>.json. */
export function deploymentFileFromEnv(
  network: NetworkName,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.DEPLOYMENT_FILE ? repoPath(env.DEPLOYMENT_FILE) : defaultDeploymentFile(network);
}

export function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Connects to Cardano, or exits with an explanation a non-specialist can act on. */
export async function connectOrExit(options: ConnectOptions): Promise<LucidEvolution> {
  const { network, provider } = options;
  const prefix = network.toLowerCase(); // Blockfrost ids start with their network's name
  if (provider === 'blockfrost' && !options.blockfrostProjectId?.trim().startsWith(prefix)) {
    fail(
      `BLOCKFROST_PROJECT_ID in .env must be the id of a ${network} project from blockfrost.io\n` +
        `  (it starts with "${prefix}"). Nothing was sent.`,
    );
  }
  try {
    return await connect(options);
  } catch (err) {
    const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
    fail(
      `Could not reach the Cardano ${network} network through ${provider}. Nothing was sent.\n` +
        `  ${detail}\n` +
        (provider === 'koios'
          ? '  Check your internet connection. If Koios is down or rate-limiting you, create a free\n' +
            `  ${network} project at https://blockfrost.io and set CARDANO_PROVIDER=blockfrost and BLOCKFROST_PROJECT_ID.`
          : `  Check your internet connection, and that BLOCKFROST_PROJECT_ID is your ${network} project's id.`),
    );
  }
}
