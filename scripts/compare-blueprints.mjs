/**
 * Fails if two Aiken blueprints compile to different validators. The
 * preamble (compiler build string) is ignored: only what goes on-chain counts.
 *
 *   node scripts/compare-blueprints.mjs committed.json fresh.json
 */
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2).map((path) => JSON.parse(readFileSync(path, 'utf8')));
const index = (bp) => new Map(bp.validators.map((v) => [v.title, v.compiledCode]));
const left = index(a);
const right = index(b);
const titles = new Set([...left.keys(), ...right.keys()]);
const differ = [...titles].filter((t) => left.get(t) !== right.get(t));

if (differ.length > 0) {
  console.error(
    `Validators differ from the committed contracts/plutus.json:\n  ${differ.join('\n  ')}`,
  );
  console.error('Run `npm run contracts:build` and commit the result.');
  process.exit(1);
}
console.log(`All ${titles.size} validators match.`);
