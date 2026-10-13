import type { Basket } from '@mch/index-core';
import type { Config } from './config.ts';
import type { OracleReader } from './oracle-reader.ts';

/** On-chain oracle panel. Disabled until a deployment file is configured. */
export async function createOracleReader(
  config: Config,
  _basket: Basket,
): Promise<OracleReader | undefined> {
  if (!config.ORACLE_DEPLOYMENT_FILE) return undefined;
  throw new Error('ORACLE_DEPLOYMENT_FILE is set but the chain reader is not wired up yet');
}
