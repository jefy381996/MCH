/** npm run chain:status — prints the oracle feed as the chain sees it. */
import { loadDeployment } from '../src/deployment.ts';
import { createProvider } from '../src/network.ts';
import { createOracleReader } from '../src/reader.ts';
import { connectOptionsFromEnv, defaultDeploymentFile } from './env.ts';

const options = connectOptionsFromEnv();
const deployment = loadDeployment(
  process.env.DEPLOYMENT_FILE ?? defaultDeploymentFile(options.network),
);
const status = await createOracleReader(deployment, createProvider(options)).read();
console.log(
  status ? JSON.stringify(status, null, 2) : 'No oracle UTxO found: the feed may have been closed.',
);
