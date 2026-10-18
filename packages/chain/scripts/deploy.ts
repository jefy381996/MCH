/**
 * npm run chain:mint-coin   creates only the MCH coin
 * npm run chain:deploy      creates whatever is still missing: the coin and/or the price oracle
 *
 * The record of what was created goes to deployments/<network>.json after
 * each step. The coin can exist on its own: the oracle is added later, once
 * real prices are connected. The steps that spend ADA live in
 * src/deploy-flow.ts, where they are tested against an emulated ledger.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { paymentCredentialOf, walletFromSeed } from '@lucid-evolution/lucid';
import { parseBasket, snapshotFromDTO, type IndexSnapshotDTO } from '@mch/index-core';
import { runDeploy } from '../src/deploy-flow.ts';
import { loadDeployment, planDeployment, saveDeployment } from '../src/deployment.ts';
import { explorerTokenUrl } from '../src/network.ts';
import { loadSeed } from '../src/secrets.ts';
import { connectOptionsFromEnv, connectOrExit, defaultDeploymentFile, fail } from './env.ts';

const env = process.env;
const args = new Set(process.argv.slice(2));
const tokenOnly = args.has('--token-only');
const assumeYes = args.has('--yes');
const allowSecondCoin = args.has('--allow-second-coin');

const options = connectOptionsFromEnv();
const { network } = options;
const isMainnet = network === 'Mainnet';
const deploymentFile = env.DEPLOYMENT_FILE ?? defaultDeploymentFile(network);
const basketFile =
  env.BASKET_FILE ?? fileURLToPath(new URL('../../../config/basket.json', import.meta.url));
const basket = parseBasket(JSON.parse(readFileSync(basketFile, 'utf8')));

// ---- what are we allowed to do? (all checked before touching the network) ----
const existing = existsSync(deploymentFile) ? loadDeployment(deploymentFile) : null;
if (existing && existing.network !== network) {
  fail(
    `${deploymentFile} records a ${existing.network} deployment, but CARDANO_NETWORK is ${network}.`,
  );
}
const plan = planDeployment(existing, { tokenOnly });
if (!plan.ok) fail(plan.reason);

if (isMainnet && env.MCH_MAINNET_ACKNOWLEDGED !== 'yes') {
  fail(
    'Real Cardano (Mainnet) is locked. Read docs/MAINNET-COIN.md, then set MCH_MAINNET_ACKNOWLEDGED=yes in .env.',
  );
}
if (isMainnet && plan.createOracle && basket.isDemo) {
  fail(
    'The price oracle cannot go on Mainnet with demo prices.\n' +
      '  Create only the coin with `npm run chain:mint-coin`; add the oracle once real prices are connected.',
  );
}
if (isMainnet && !assumeYes && !process.stdin.isTTY) {
  fail('Mainnet needs a typed confirmation: run this in a terminal (or pass --yes).');
}

// ---- coin settings: the supply and asset name are permanent ----
function wholeNumber(name: string, fallback: string): bigint {
  const raw = (env[name] ?? fallback).replace(/[,_\s]/g, '');
  if (!/^\d+$/.test(raw)) fail(`${name} must be a whole number, got "${env[name]}".`);
  return BigInt(raw);
}
const assetName = env.TOKEN_NAME ?? 'MCH';
if (!/^[A-Za-z0-9]{1,28}$/.test(assetName)) fail('TOKEN_NAME must be 1-28 letters or digits.');
const decimals = Number(wholeNumber('TOKEN_DECIMALS', '6'));
if (decimals > 18) fail('TOKEN_DECIMALS must be between 0 and 18.');
const wholeSupply = wholeNumber('TOKEN_SUPPLY', '100000000');
const supply = wholeSupply * 10n ** BigInt(decimals);
if (supply <= 0n || supply > 2n ** 63n - 1n) {
  fail('TOKEN_SUPPLY x 10^TOKEN_DECIMALS must be above 0 and below 9.2 x 10^18 (a Cardano limit).');
}

let adminSeed: string;
try {
  adminSeed = loadSeed('admin');
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

// ---- connect, then hand over to the tested flow ----
const lucid = await connectOrExit(options);
lucid.selectWallet.fromSeed(adminSeed);

const outcome = await runDeploy({
  lucid,
  network,
  existing,
  plan,
  basket,
  allowSecondCoin,
  coin: {
    assetName,
    wholeSupply,
    decimals,
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
  },
  async confirm(summary) {
    console.log(`\n${summary}\n`);
    if (!isMainnet || assumeYes) return true;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type CREATE to go ahead, or anything else to stop: ');
    rl.close();
    return answer.trim() === 'CREATE';
  },
  operator: () =>
    paymentCredentialOf(walletFromSeed(loadSeed('operator'), { network }).address).hash,
  genesisPrices,
  save: (d) => saveDeployment(deploymentFile, d),
  log: (line) => console.log(line),
  now: () => Date.now(),
});

if (outcome.kind === 'refused') fail(outcome.reason);
if (outcome.kind === 'cancelled') fail('Stopped. Nothing was sent.');

const { deployment } = outcome;
console.log(`\nDone. Record: ${deploymentFile}`);
if (deployment.token) {
  const whole = BigInt(deployment.token.supply) / 10n ** BigInt(deployment.token.decimals);
  console.log(`  Your coin: ${explorerTokenUrl(network, deployment.token.fungibleUnit)}`);
  console.log(`  All ${whole.toLocaleString('en-GB')} coins are in the admin wallet.`);
}
console.log('  Keep the record file and commit it: it is the public record of what you created.\n');

/**
 * Opening prices for the oracle: the live index from the backend if reachable,
 * otherwise the base prices (index 100). On Mainnet they must be real.
 */
async function genesisPrices(): Promise<bigint[]> {
  const api = env.PRICE_API_URL;
  if (api) {
    const res = await fetch(new URL('/api/index', api));
    const body = (await res.json()) as {
      snapshot: IndexSnapshotDTO | null;
      dataSource?: { isDemo: boolean };
    };
    if (isMainnet && body.dataSource?.isDemo !== false) {
      fail('The backend at PRICE_API_URL is serving demo prices. Mainnet needs real ones.');
    }
    if (body.snapshot) {
      const snapshot = snapshotFromDTO(body.snapshot);
      return basket.components.map(
        (c) => snapshot.components.find((x) => x.metal === c.metal)!.priceMicro,
      );
    }
  }
  if (isMainnet)
    fail('Set PRICE_API_URL to a backend serving real prices before creating the Mainnet oracle.');
  return basket.components.map((c) => c.basePriceMicro);
}
