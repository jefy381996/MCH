/**
 * npm run chain:mint-coin   creates only the MCH coin
 * npm run chain:deploy      creates whatever is still missing: the coin and/or the price oracle
 *
 * The record of what was created goes to deployments/<network>.json after
 * each step. The coin can exist on its own: the oracle is added later, once
 * real prices are connected. The steps that spend ADA live in
 * src/deploy-flow.ts, where they are tested against an emulated ledger.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { paymentCredentialOf, walletFromSeed } from '@lucid-evolution/lucid';
import { parseBasket, snapshotFromDTO, type IndexSnapshotDTO } from '@mch/index-core';
import { runDeploy } from '../src/deploy-flow.ts';
import {
  loadDeployment,
  planDeployment,
  saveDeployment,
  type Deployment,
} from '../src/deployment.ts';
import { explorerTokenUrl, explorerTxUrl } from '../src/network.ts';
import { acquireRunLock } from '../src/run-lock.ts';
import { loadSeed } from '../src/secrets.ts';
import {
  connectOptionsFromEnv,
  connectOrExit,
  deploymentFileFromEnv,
  fail,
  repoPath,
} from './env.ts';

const env = process.env;
const args = new Set(process.argv.slice(2));
const tokenOnly = args.has('--token-only');
const assumeYes = args.has('--yes');
const allowSecondCoin = args.has('--allow-second-coin');

const options = connectOptionsFromEnv();
const { network } = options;
const isMainnet = network === 'Mainnet';
const deploymentFile = deploymentFileFromEnv(network);
const basketFile = env.BASKET_FILE ? repoPath(env.BASKET_FILE) : repoPath('config/basket.json');
const basket = parseBasket(JSON.parse(readFileSync(basketFile, 'utf8')));

// ---- one run at a time: two windows could otherwise each make a coin ----
mkdirSync(dirname(deploymentFile), { recursive: true });
const lockFile = `${deploymentFile}.lock`;
const lock = acquireRunLock(lockFile);
if (!lock.ok) {
  fail(
    'This is already running in another window, so this one stopped. Nothing was sent.\n' +
      '  Finish or close the other window first. If no other window is open, delete this file\n' +
      `  and run it again: ${lockFile}`,
  );
}
process.on('exit', () => lock.release());

// ---- what are we allowed to do? (all checked before touching the network) ----
let existing: Deployment | null = null;
if (existsSync(deploymentFile)) {
  try {
    existing = loadDeployment(deploymentFile);
  } catch (err) {
    fail(
      `${err instanceof Error ? err.message : String(err)}\n` +
        '  Nothing was sent. Do NOT delete it: send it to me as it is.',
    );
  }
}
if (existing && existing.network !== network) {
  fail(
    `${deploymentFile} records a ${existing.network} deployment, but CARDANO_NETWORK is ${network}.`,
  );
}
const plan = planDeployment(existing, { tokenOnly });
if (!plan.ok) fail(plan.reason);

if (isMainnet && env.MCH_MAINNET_ACKNOWLEDGED?.trim().toLowerCase() !== 'yes') {
  fail(
    'Real Cardano (Mainnet) is locked. Read docs/MAINNET-COIN.md, then set MCH_MAINNET_ACKNOWLEDGED=yes in .env.',
  );
}
if (isMainnet && plan.oracle === 'create' && basket.isDemo) {
  fail(
    'The price oracle cannot go on Mainnet with demo prices.\n' +
      '  Create only the coin with `npm run chain:mint-coin`; add the oracle once real prices are connected.',
  );
}
if (isMainnet && !assumeYes && !process.stdin.isTTY) {
  fail(
    'This needs you to type a confirmation, and this window cannot take typing.\n' +
      '  Run it in Command Prompt (Windows) or Terminal (Mac).',
  );
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
// CIP-68 requires the logo to be a URI with one of these schemes; wallets drop anything else.
const logo = env.TOKEN_LOGO?.trim();
if (logo && !/^(https|ipfs|ar):\/\/\S+$|^data:image\/\S+$/.test(logo)) {
  fail(
    'TOKEN_LOGO must be a link starting with https://, ipfs:// or ar:// (no spaces).\n' +
      '  Leave it empty for now if you do not have one: it can be added later.',
  );
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
const again = tokenOnly ? 'npm run chain:mint-coin' : 'npm run chain:deploy';

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
      // `||`: a line left as "TOKEN_TICKER=" means the default, not a blank name.
      name: env.TOKEN_DISPLAY_NAME?.trim() || 'Metal Chain',
      description:
        env.TOKEN_DESCRIPTION?.trim() ||
        'MCH tracks the MCH Index of gold, silver, platinum and nickel. Not backed by metal and not redeemable.',
      ticker: env.TOKEN_TICKER?.trim() || 'MCH',
      decimals,
      url: env.TOKEN_URL,
      logo: logo || undefined,
    },
  },
  async confirm(summary) {
    console.log(`\n${summary}\n`);
    if (!isMainnet || assumeYes) return true;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answer: string;
    try {
      answer = await rl.question('Type CREATE to go ahead, or anything else to stop: ');
    } catch {
      return false; // Ctrl+C or a closed window: stop, nothing sent
    } finally {
      rl.close();
    }
    if (answer.trim() !== 'CREATE') return false;
    // From here on something may be sent; Ctrl+C must not leave the reader guessing.
    process.once('SIGINT', () => {
      console.log(
        '\n\n⏳ Stopped while working. Anything already sent is in the record, so nothing is lost.\n' +
          `   Wait 10 minutes, then run \`${again}\` again. It finishes the job and never makes a second coin.\n`,
      );
      process.exit(130);
    });
    return true;
  },
  operator: () =>
    paymentCredentialOf(walletFromSeed(loadSeed('operator'), { network }).address).hash,
  genesisPrices,
  save: (d) => saveDeployment(deploymentFile, d),
  log: (line) => console.log(line),
  now: () => Date.now(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
}).catch((err: unknown) =>
  fail(
    `Stopped by an unexpected problem: ${err instanceof Error ? err.message : String(err)}\n` +
      '  Anything already sent is in the record. Fix the problem above if you can, then run\n' +
      `  \`${again}\` again: it checks the network first and never makes a second coin.`,
  ),
);

if (outcome.kind === 'refused') fail(outcome.reason);
if (outcome.kind === 'cancelled') fail('Stopped. Nothing was sent.');
if (outcome.kind === 'pending') {
  const what = outcome.what === 'coin' ? 'The MCH coin' : 'The price oracle';
  console.log(
    !outcome.sendError
      ? `\n⏳ ${what} was sent, but the network has not confirmed it yet.`
      : outcome.resent
        ? `\n⏳ Sending the new copy reported a problem: ${outcome.sendError}\n   Most likely the first copy is still on its way.`
        : `\n⏳ Sending reported a problem: ${outcome.sendError}\n   It may or may not have reached the network.`,
  );
  console.log(`   Transaction: ${explorerTxUrl(network, outcome.txHash)}`);
  console.log('   The record is saved, so nothing is lost. Do not buy more ADA.');
  console.log(
    `   Wait 10 minutes, then run \`${again}\` again. It checks the network and finishes the job;`,
  );
  console.log('   it will NOT create a second coin.\n');
  process.exit(0);
}

const { deployment } = outcome;
console.log(`\nDone. Record: ${deploymentFile}`);
if (deployment.token) {
  const whole = BigInt(deployment.token.supply) / 10n ** BigInt(deployment.token.decimals);
  console.log(`  Your coin: ${explorerTokenUrl(network, deployment.token.fungibleUnit)}`);
  console.log(`  All ${whole.toLocaleString('en-GB')} coins are in the admin wallet.`);
}
console.log(
  '  Keep the record file: it is the public record of what you created (guide Step 8).\n',
);

/**
 * Opening prices for the oracle: the live index from the backend if reachable,
 * otherwise the base prices (index 100). On Mainnet they must be real.
 */
async function genesisPrices(): Promise<bigint[]> {
  const api = env.PRICE_API_URL;
  if (api) {
    let body: { snapshot: IndexSnapshotDTO | null; dataSource?: { isDemo: boolean } };
    try {
      body = (await (await fetch(new URL('/api/index', api))).json()) as typeof body;
    } catch (err) {
      if (isMainnet) {
        fail(
          `Could not get prices from PRICE_API_URL (${api}). Nothing was sent.\n  ${String(err)}`,
        );
      }
      return basket.components.map((c) => c.basePriceMicro); // test network: base prices
    }
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
