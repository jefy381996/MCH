import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderAikenVectors } from './aiken-vectors.ts';

const path = fileURLToPath(
  new URL('../../../contracts/lib/mch/index_vectors.test.ak', import.meta.url),
);

writeFileSync(path, renderAikenVectors());
console.log(`wrote ${path}`);

// Match `aiken fmt` so the formatting check in CI stays green. The drift test
// ignores whitespace, so skipping this when Aiken is not installed is harmless.
const fmt = spawnSync('aiken', ['fmt', path], { stdio: 'inherit' });
if (fmt.error) console.warn('aiken not found; skipped formatting (run `aiken fmt` later)');
