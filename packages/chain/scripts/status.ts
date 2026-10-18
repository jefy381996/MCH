/** npm run chain:status — prints what exists on-chain for this network. */
import { loadDeployment } from '../src/deployment.ts';
import { createProvider } from '../src/network.ts';
import { createOracleReader } from '../src/reader.ts';
import { connectOptionsFromEnv, defaultDeploymentFile } from './env.ts';

const options = connectOptionsFromEnv();
const deployment = loadDeployment(
  process.env.DEPLOYMENT_FILE ?? defaultDeploymentFile(options.network),
);
const reader = createOracleReader(deployment, createProvider(options));
console.log(JSON.stringify({ network: reader.network, coin: reader.token }, null, 2));
if (!reader.hasOracle) {
  console.log('No price oracle has been created on this network yet.');
} else {
  const status = await reader.read();
  console.log(
    status
      ? JSON.stringify({ oracle: status }, null, 2)
      : 'Oracle not found on-chain: it may have been closed.',
  );
}
