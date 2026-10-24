/**
 * npm run chain:wallets
 *
 * Creates the two wallets the oracle needs (if they do not exist yet) and
 * prints their addresses so you can fund them from the testnet faucet.
 */
import { addressOf, ensureSeed, loadSeed, SECRETS_DIR, type Role } from '../src/secrets.ts';
import { connectOptionsFromEnv, fail } from './env.ts';

const { network } = connectOptionsFromEnv();
const isMainnet = network === 'Mainnet';
const roles: Array<[Role, string]> = [
  ['admin', 'cold key: deploys the oracle and token, can rotate the operator key'],
  [
    'operator',
    isMainnet
      ? 'for the price oracle later. Do NOT send ADA here for the coin'
      : 'hot key: signs every price update, runs on the server',
  ],
];

console.log(`\nMCH wallets on ${network}\n`);
for (const [role, purpose] of roles) {
  const created = ensureSeed(role);
  let address: string;
  try {
    address = addressOf(loadSeed(role), network);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  console.log(`  ${role.padEnd(9)} ${address}`);
  console.log(`  ${''.padEnd(9)} ${purpose}${created ? '  [NEW]' : ''}\n`);
}
console.log(
  isMainnet
    ? `Your recovery phrases are in ${SECRETS_DIR} (Git never uploads them).\n` +
        'Never copy these files to the cloud, an email or a photo.\n' +
        'To see these addresses again later, run this again: it never replaces an existing wallet.'
    : `Seed phrases are in ${SECRETS_DIR} (git-ignored). Back them up somewhere safe.`,
);
if (network !== 'Mainnet') {
  console.log(`
Next: get free test ADA for both addresses from the faucet
  https://docs.cardano.org/cardano-testnets/tools/faucet   (choose "${network}")
  admin: at least 100 test ADA     operator: at least 50 test ADA
Then run: npm run chain:deploy
`);
} else {
  console.log(`
REAL CARDANO. Before sending any ADA:
  1. Write the admin recovery phrase (secrets/admin.seed) on paper and keep it somewhere safe.
     Whoever has those 24 words controls every MCH coin. Anyone asking for them is a scammer.
  2. Send 15 ADA to the admin address above (at least 10 must arrive).
  3. Run: npm run chain:mint-coin
Full guide: docs/MAINNET-COIN.md
`);
}
