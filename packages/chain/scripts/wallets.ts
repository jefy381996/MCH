/**
 * npm run chain:wallets
 *
 * Creates the two wallets the oracle needs (if they do not exist yet) and
 * prints their addresses so you can fund them from the testnet faucet.
 */
import { addressOf, ensureSeed, loadSeed, SECRETS_DIR, type Role } from '../src/secrets.ts';
import { connectOptionsFromEnv } from './env.ts';

const { network } = connectOptionsFromEnv();
const roles: Array<[Role, string]> = [
  ['admin', 'cold key: deploys the oracle and token, can rotate the operator key'],
  ['operator', 'hot key: signs every price update, runs on the server'],
];

console.log(`\nMCH wallets on ${network}\n`);
for (const [role, purpose] of roles) {
  const created = ensureSeed(role);
  console.log(`  ${role.padEnd(9)} ${addressOf(loadSeed(role), network)}`);
  console.log(`  ${''.padEnd(9)} ${purpose}${created ? '  [NEW]' : ''}\n`);
}
console.log(`Seed phrases are in ${SECRETS_DIR} (git-ignored). Back them up somewhere safe.`);
if (network !== 'Mainnet') {
  console.log(`
Next: get free test ADA for both addresses from the faucet
  https://docs.cardano.org/cardano-testnets/tools/faucet   (choose "${network}")
  admin: at least 100 test ADA     operator: at least 50 test ADA
Then run: npm run chain:deploy
`);
} else {
  console.log(
    '\nMainnet: the admin key should live on a hardware wallet, not in a file. See docs/LAUNCH-CHECKLIST.md.\n',
  );
}
