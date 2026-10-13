import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDotEnv } from '../src/env.ts';

describe('loadDotEnv', () => {
  afterEach(() => {
    delete process.env.MCH_TEST_A;
    delete process.env.MCH_TEST_B;
  });

  it('does nothing when there is no .env (a fresh clone)', () => {
    expect(() => loadDotEnv(join(tmpdir(), 'definitely-missing', '.env'))).not.toThrow();
  });

  it('loads the file, but real environment variables win', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'mch-env-')), '.env');
    writeFileSync(file, 'MCH_TEST_A=from-file\nMCH_TEST_B=from-file\n');
    process.env.MCH_TEST_A = 'from-shell';
    loadDotEnv(file);
    expect(process.env.MCH_TEST_A).toBe('from-shell');
    expect(process.env.MCH_TEST_B).toBe('from-file');
  });
});
