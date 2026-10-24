/**
 * The guards around the money path that live outside it: one run at a time,
 * a .env that cannot silently disagree with itself, a recovery phrase that
 * was damaged in an editor, and a record file that cannot be half-written.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSeedPhrase } from '@lucid-evolution/lucid';
import { describe, expect, it } from 'vitest';
import { repeatedKeys } from '../scripts/env.ts';
import { loadDeployment, saveDeployment, type Deployment } from '../src/deployment.ts';
import { acquireRunLock } from '../src/run-lock.ts';
import { loadSeed } from '../src/secrets.ts';
import { knownMainnetWallets, rememberMainnetWallet } from '../src/wallet-registry.ts';

const folder = () => mkdtempSync(join(tmpdir(), 'mch-safety-'));
/** The id of a process that has already ended. */
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid!;

describe('one run at a time', () => {
  it('refuses a second run while the first is alive, and frees the lock when it ends', () => {
    const path = join(folder(), 'mainnet.json.lock');
    const first = acquireRunLock(path);
    expect(first.ok).toBe(true);
    const second = acquireRunLock(path, process.pid + 1); // another window
    expect(second).toEqual({ ok: false, pid: process.pid });
    if (first.ok) first.release();
    expect(existsSync(path)).toBe(false);
    expect(acquireRunLock(path, process.pid + 1).ok).toBe(true);
  });

  it('takes over a lock left by a run that ended without cleaning up', () => {
    const path = join(folder(), 'mainnet.json.lock');
    writeFileSync(path, String(deadPid()));
    expect(acquireRunLock(path).ok).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
    writeFileSync(path, ''); // a crash between creating and writing it
    expect(acquireRunLock(path).ok).toBe(true);
  });
});

describe('.env lines that disagree with each other', () => {
  it('finds a setting given twice, as when a block is pasted in instead of edited', () => {
    const text =
      '\uFEFFCARDANO_NETWORK=Mainnet\r\nMCH_MAINNET_ACKNOWLEDGED=yes\r\n# CARDANO_NETWORK=Preview\r\nPORT=1\r\nCARDANO_NETWORK=Preprod\r\n';
    expect(repeatedKeys(text)).toEqual(['CARDANO_NETWORK']);
  });

  it('accepts the template as it is', () => {
    expect(
      repeatedKeys(readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8')),
    ).toEqual([]);
  });
});

describe('the recovery phrase file', () => {
  const phrase = generateSeedPhrase();

  it('reads a phrase even with its words on separate lines or in capitals', () => {
    const dir = folder();
    writeFileSync(
      join(dir, 'admin.seed'),
      `\uFEFF${phrase.toUpperCase().split(' ').join('\r\n')}\r\n`,
    );
    expect(loadSeed('admin', {}, dir)).toBe(phrase);
  });

  it('says plainly when the phrase was damaged, and not to make a new wallet', () => {
    const dir = folder();
    const words = phrase.split(' ');
    words[3] = `${words[3]}x`;
    writeFileSync(join(dir, 'admin.seed'), words.join(' '));
    expect(() => loadSeed('admin', {}, dir)).toThrow(
      /no longer a valid recovery phrase[\s\S]*Nothing was sent[\s\S]*Do NOT delete it/,
    );
  });

  it('warns against making a new wallet when the file is missing', () => {
    expect(() => loadSeed('admin', {}, folder())).toThrow(
      /secrets\/admin\.seed is missing\)\. Nothing was sent[\s\S]*do NOT make a new one/,
    );
  });

  it('checks a phrase given as an environment variable too', () => {
    expect(loadSeed('admin', { ADMIN_SEED: ` ${phrase} ` }, folder())).toBe(phrase);
    expect(() => loadSeed('admin', { ADMIN_SEED: 'not a phrase' }, folder())).toThrow(
      /ADMIN_SEED is not a valid recovery phrase/,
    );
  });
});

describe('the record file', () => {
  const record: Deployment = {
    network: 'Mainnet',
    deployedAt: '2026-10-24T00:00:00.000Z',
    blueprint: {},
  };

  it('is replaced whole, leaving no partial copy behind', () => {
    const path = join(folder(), 'deployments', 'mainnet.json');
    saveDeployment(path, record);
    saveDeployment(path, { ...record, deployedAt: 'later' });
    expect(loadDeployment(path).deployedAt).toBe('later');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it('reads a record an editor saved with a BOM, and explains a damaged one', () => {
    const path = join(folder(), 'mainnet.json');
    writeFileSync(path, `\uFEFF${JSON.stringify(record)}`);
    expect(loadDeployment(path)).toEqual(record);
    writeFileSync(path, '{"network": "Mainnet", "deployedAt"');
    expect(() => loadDeployment(path)).toThrow(/could not be read/);
  });
});

describe('the note of Mainnet wallets made on this computer', () => {
  it('remembers each wallet once, with the folder it was first seen in', () => {
    const dir = folder();
    expect(knownMainnetWallets(dir)).toEqual([]);
    rememberMainnetWallet('addr1qxyz', '/Users/me/MCH', dir);
    rememberMainnetWallet('addr1qxyz', '/Users/me/MCH-copy', dir); // same wallet, renamed folder
    expect(knownMainnetWallets(dir)).toEqual([{ address: 'addr1qxyz', folder: '/Users/me/MCH' }]);
  });

  it('never stops the caller when the note cannot be written', () => {
    const file = join(folder(), 'not-a-folder');
    writeFileSync(file, '');
    expect(() => rememberMainnetWallet('addr1qxyz', '/x', file)).not.toThrow();
  });
});
