import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * A note, kept outside the project folder, of the Mainnet admin wallets made
 * on this computer. Renaming, deleting or re-downloading the MCH folder would
 * otherwise lead to a fresh wallet that knows nothing about a coin made with
 * the old one, and the second-coin guard (which looks inside the wallet)
 * could not see it.
 */
export const REGISTRY_DIR = join(homedir(), '.mch');
const FILE = 'mainnet-wallets.txt';

export interface KnownWallet {
  address: string;
  /** The MCH folder it was first seen in. */
  folder: string;
}

export function knownMainnetWallets(dir = REGISTRY_DIR): KnownWallet[] {
  const path = join(dir, FILE);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter(([address, folder]) => address?.startsWith('addr1') && folder)
    .map(([address, folder]) => ({ address: address!, folder: folder! }));
}

/** Notes a Mainnet admin wallet, once. Best effort: never stops the caller. */
export function rememberMainnetWallet(address: string, folder: string, dir = REGISTRY_DIR): void {
  try {
    if (knownMainnetWallets(dir).some((w) => w.address === address)) return;
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, FILE), `${address}\t${folder}\t${new Date().toISOString()}\n`);
  } catch {
    // an unwritable home folder only weakens this extra check
  }
}
