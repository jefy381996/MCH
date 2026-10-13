import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderAikenVectors } from '../scripts/aiken-vectors.ts';

/** `aiken fmt` reflows lines and drops trailing commas; compare everything else. */
const squash = (s: string) => s.replace(/\s+/g, '').replace(/,(?=[\])}])/g, '');

describe('contracts/lib/mch/index_vectors.test.ak', () => {
  it('is up to date (run: npm run gen:aiken-vectors -w @mch/index-core)', () => {
    const path = fileURLToPath(
      new URL('../../../contracts/lib/mch/index_vectors.test.ak', import.meta.url),
    );
    expect(squash(readFileSync(path, 'utf8'))).toBe(squash(renderAikenVectors()));
  });
});
