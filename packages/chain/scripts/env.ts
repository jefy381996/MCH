import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LucidEvolution } from '@lucid-evolution/lucid';
import { connect, isNetworkName, type ConnectOptions, type NetworkName } from '../src/network.ts';

// Every chain script imports this module first, so .env is loaded before
// anything reads process.env. Real environment variables win.
const dotEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(dotEnv)) process.loadEnvFile(dotEnv);

/** Network and provider settings shared by every chain script. */
export function connectOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): ConnectOptions {
  const network = env.CARDANO_NETWORK ?? 'Preprod';
  if (!isNetworkName(network))
    throw new Error(`CARDANO_NETWORK must be Preprod, Preview or Mainnet, not "${network}"`);
  const provider = env.CARDANO_PROVIDER ?? 'koios';
  if (provider !== 'koios' && provider !== 'blockfrost') {
    throw new Error(`CARDANO_PROVIDER must be koios or blockfrost, not "${provider}"`);
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
  try {
    return await connect(options);
  } catch (err) {
    const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
    fail(
      `Could not reach the Cardano ${options.network} network through ${options.provider}.\n` +
        `  ${detail}\n` +
        '  Check your internet connection. If Koios is down or rate-limiting you, create a free\n' +
        '  project at https://blockfrost.io and set CARDANO_PROVIDER=blockfrost and BLOCKFROST_PROJECT_ID.',
    );
  }
}
