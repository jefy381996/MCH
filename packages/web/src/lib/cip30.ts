import { Decoder } from 'cbor-x';

/** The parts of the CIP-30 wallet bridge MCH uses. */
export interface Cip30Api {
  getNetworkId(): Promise<number>;
  getBalance(): Promise<string>;
}

export interface Cip30Provider {
  name: string;
  icon: string;
  apiVersion?: string;
  enable(): Promise<Cip30Api>;
}

export interface DetectedWallet {
  key: string;
  name: string;
  icon: string;
  provider: Cip30Provider;
}

/** Browser-extension wallets that announced themselves on window.cardano. */
export function detectWallets(): DetectedWallet[] {
  // Typed locally: other libraries declare their own (incompatible) window.cardano.
  const injected =
    typeof window === 'undefined' ? undefined : (window as { cardano?: unknown }).cardano;
  return walletsFrom(injected as Record<string, unknown> | undefined);
}

/** The CIP-30 wallets in a window.cardano-shaped object. */
export function walletsFrom(cardano: Record<string, unknown> | undefined): DetectedWallet[] {
  if (!cardano) return [];
  return Object.entries(cardano)
    .filter((entry): entry is [string, Cip30Provider] => {
      const p = entry[1] as Partial<Cip30Provider> | null;
      return !!p && typeof p.enable === 'function' && typeof p.name === 'string';
    })
    .map(([key, provider]) => ({
      key,
      name: provider.name,
      icon:
        typeof provider.icon === 'string' && provider.icon.startsWith('data:image/')
          ? provider.icon
          : '',
      provider,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Maps keep byte-string keys; quantities beyond 2^53 decode as bigint.
const decoder = new Decoder({ mapsAsObjects: false, useRecords: false });

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  throw new TypeError('unexpected quantity in wallet balance');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Quantity of one asset in a CIP-30 getBalance() result. The balance is a
 * CBOR ledger Value: either a bare coin, or [coin, {policy: {name: qty}}].
 */
export function assetQuantity(balanceCborHex: string, unit: string): bigint {
  const policy = unit.slice(0, 56).toLowerCase();
  const name = unit.slice(56).toLowerCase();
  const value = decoder.decode(hexToBytes(balanceCborHex)) as unknown;
  if (!Array.isArray(value)) return 0n;
  const multiAsset = value[1];
  if (!(multiAsset instanceof Map)) return 0n;
  for (const [policyBytes, assets] of multiAsset as Map<Uint8Array, unknown>) {
    if (toHex(policyBytes) !== policy || !(assets instanceof Map)) continue;
    for (const [nameBytes, quantity] of assets as Map<Uint8Array, unknown>) {
      if (toHex(nameBytes) === name) return toBigInt(quantity);
    }
  }
  return 0n;
}

/** Lovelace in a balance, for "wallet connected" sanity display. */
export function lovelace(balanceCborHex: string): bigint {
  const value = decoder.decode(hexToBytes(balanceCborHex)) as unknown;
  return toBigInt(Array.isArray(value) ? value[0] : value);
}
