import type { Basket } from '@mch/index-core';
import type { Config } from './config.ts';
import type { OracleReader } from './oracle-reader.ts';

/** On-chain panels (coin and oracle). Disabled until ORACLE_DEPLOYMENT_FILE points at a deployment. */
export async function createOracleReader(
  config: Config,
  basket: Basket,
): Promise<OracleReader | undefined> {
  if (!config.ORACLE_DEPLOYMENT_FILE) return undefined;
  // Loaded lazily: the Cardano libraries are large and only needed here.
  const chain = await import('@mch/chain');
  const deployment = chain.loadDeployment(config.ORACLE_DEPLOYMENT_FILE);
  if (deployment.network === 'Custom')
    throw new Error('cannot read an emulator deployment from a live server');
  if (deployment.oracle && deployment.oracle.basket.version !== basket.version) {
    throw new Error(
      `config basket is v${basket.version} but the deployed oracle uses v${deployment.oracle.basket.version}`,
    );
  }
  const provider = chain.createProvider({
    network: deployment.network,
    provider: config.CARDANO_PROVIDER,
    blockfrostProjectId: config.BLOCKFROST_PROJECT_ID,
  });
  return chain.createOracleReader(deployment, provider);
}
