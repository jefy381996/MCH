/**
 * npm run chain:deploy
 *
 * Creates the oracle feed and mints the fixed MCH supply, then writes
 * deployments/<network>.json for the backend and the submitter to use.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { paymentCredentialOf, walletFromSeed } from '@lucid-evolution/lucid';
import { parseBasket, snapshotFromDTO, type IndexSnapshotDTO } from '@mch/index-core';
import { blueprintHashes } from '../src/blueprint.ts';
import { saveDeployment, basketFileOf, type Deployment } from '../src/deployment.ts';
import { explorerTokenUrl, explorerTxUrl } from '../src/network.ts';
import { createOracle, findReferenceScript, readFeed } from '../src/oracle-ops.ts';
import { loadSeed } from '../src/secrets.ts';
import { mintToken } from '../src/token-ops.ts';
import { connectOptionsFromEnv, connectOrExit, defaultDeploymentFile, fail } from './env.ts';

const env = process.env;
const options = connectOptionsFromEnv();
const { network } = options;
const deploymentFile = env.DEPLOYMENT_FILE ?? defaultDeploymentFile(network);
const basketFile =
  env.BASKET_FILE ?? fileURLToPath(new URL('../../../config/basket.json', import.meta.url));
const basket = parseBasket(JSON.parse(readFileSync(basketFile, 'utf8')));

if (network === 'Mainnet') {
  if (env.MCH_MAINNET_ACKNOWLEDGED !== 'yes') {
    fail(
      'Mainnet deployment is locked. Complete docs/LAUNCH-CHECKLIST.md first (legal, audit, data licence).',
    );
  }
  if (basket.isDemo)
    fail('The basket is marked as demo data. Set real base prices before mainnet.');
}
if (existsSync(deploymentFile) && !process.argv.includes('--force')) {
  fail(
    `${deploymentFile} already exists. A second deploy creates a second, separate oracle. Use --force if you mean it.`,
  );
}

const decimals = Number(env.TOKEN_DECIMALS ?? 6);
const wholeSupply = BigInt(env.TOKEN_SUPPLY ?? '100000000');
const supply = wholeSupply * 10n ** BigInt(decimals);

/** Opening prices: the live index if the backend is reachable, otherwise the base prices (index 100). */
async function genesisPrices(): Promise<bigint[]> {
  const api = env.PRICE_API_URL;
  if (api) {
    const res = await fetch(new URL('/api/index', api));
    const body = (await res.json()) as { snapshot: IndexSnapshotDTO | null };
    if (body.snapshot) {
      const snapshot = snapshotFromDTO(body.snapshot);
      return basket.components.map(
        (c) => snapshot.components.find((x) => x.metal === c.metal)!.priceMicro,
      );
    }
  }
  return basket.components.map((c) => c.basePriceMicro);
}

const lucid = await connectOrExit(options);
lucid.selectWallet.fromSeed(loadSeed('admin'));
const adminAddress = await lucid.wallet().address();
const operatorAddress = walletFromSeed(loadSeed('operator'), { network }).address;
const operator = paymentCredentialOf(operatorAddress).hash;
const lovelace = (await lucid.wallet().getUtxos()).reduce(
  (sum, u) => sum + (u.assets.lovelace ?? 0n),
  0n,
);
if (lovelace < 30_000_000n)
  fail(`admin wallet ${adminAddress} has ${Number(lovelace) / 1e6} ADA; fund it with at least 30.`);

console.log(`\nDeploying MCH to ${network}`);
console.log(`  admin    ${adminAddress}`);
console.log(`  operator ${operatorAddress}`);
console.log(
  `  basket   ${basket.name} v${basket.version}${basket.isDemo ? ' (DEMO base prices)' : ''}`,
);

console.log('\n1/2 Creating the oracle feed...');
const oracle = await createOracle(lucid, {
  basket,
  operator,
  pricesMicro: await genesisPrices(),
  now: Date.now(),
  publishReferenceScript: true,
});
console.log(`    submitted ${explorerTxUrl(network, oracle.txHash)}`);
await lucid.awaitTx(oracle.txHash);
const referenceScript = await findReferenceScript(lucid, oracle.txHash);

console.log('2/2 Minting the MCH supply...');
const token = await mintToken(lucid, {
  name: env.TOKEN_NAME ?? 'MCH',
  supply,
  metadata: {
    name: env.TOKEN_DISPLAY_NAME ?? 'Metal Chain',
    description:
      env.TOKEN_DESCRIPTION ??
      'MCH tracks the MCH Index of gold, silver, platinum and nickel. Not backed by metal and not redeemable.',
    ticker: env.TOKEN_TICKER ?? 'MCH',
    decimals,
    url: env.TOKEN_URL,
    logo: env.TOKEN_LOGO,
  },
});
console.log(`    submitted ${explorerTxUrl(network, token.txHash)}`);
await lucid.awaitTx(token.txHash);

const deployment: Deployment = {
  network,
  deployedAt: new Date().toISOString(),
  blueprint: blueprintHashes(),
  oracle: {
    policyId: oracle.policyId,
    address: oracle.address,
    authUnit: oracle.authUnit,
    admin: oracle.settings.admin,
    seed: oracle.settings.seed,
    basket: basketFileOf(basket),
    maxValidityMs: oracle.settings.maxValidityMs,
    referenceScript,
    createTx: oracle.txHash,
  },
  token: {
    policyId: token.policyId,
    name: token.settings.name,
    referenceUnit: token.referenceUnit,
    fungibleUnit: token.fungibleUnit,
    supply: supply.toString(),
    decimals,
    admin: token.settings.admin,
    seed: token.settings.seed,
    metadataAddress: token.metadataAddress,
    mintTx: token.txHash,
  },
};
saveDeployment(deploymentFile, deployment);
const { datum } = await readFeed(lucid, deployment);

console.log(`
Done. Wrote ${deploymentFile}

  Oracle policy   ${oracle.policyId}
  Index on-chain  ${Number(datum.indexMicro) / 1e6}
  MCH token       ${explorerTokenUrl(network, token.fungibleUnit)}
  Supply          ${wholeSupply.toLocaleString('en-GB')} MCH (${decimals} decimals), held by the admin wallet

Next:
  1. Set ORACLE_DEPLOYMENT_FILE=${deploymentFile} for the backend to show the on-chain panel.
  2. Run the submitter to keep the chain in step: npm run chain:submitter
`);
