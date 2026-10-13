import type { LucidEvolution } from '@lucid-evolution/lucid';
import { connect, isNetworkName, type ConnectOptions, type NetworkName } from '../src/network.ts';

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

export function defaultDeploymentFile(network: NetworkName): string {
  return new URL(`../../../deployments/${network.toLowerCase()}.json`, import.meta.url).pathname;
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
