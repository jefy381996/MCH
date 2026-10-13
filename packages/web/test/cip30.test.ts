import { assetsToValue } from '@lucid-evolution/lucid';
import { describe, expect, it } from 'vitest';
import { assetQuantity, lovelace, walletsFrom } from '../src/lib/cip30.ts';

const POLICY = 'ab'.repeat(28);
const MCH = `${POLICY}0014df10${Buffer.from('MCH').toString('hex')}`;
const OTHER = `${'cd'.repeat(28)}${Buffer.from('X').toString('hex')}`;

/** Balance CBOR exactly as Cardano's serialization library (and so wallets) encode it. */
const balance = (assets: Record<string, bigint>) => assetsToValue(assets).to_cbor_hex();

describe('assetQuantity', () => {
  it('finds MCH in a multi-asset balance', () => {
    const cbor = balance({ lovelace: 12_000_000n, [MCH]: 5_000_000n, [OTHER]: 7n });
    expect(assetQuantity(cbor, MCH)).toBe(5_000_000n);
    expect(assetQuantity(cbor, OTHER)).toBe(7n);
    expect(lovelace(cbor)).toBe(12_000_000n);
  });

  it('handles quantities beyond 2^53 exactly', () => {
    const huge = 9_000_000_000_000_000_000n;
    expect(assetQuantity(balance({ lovelace: 2_000_000n, [MCH]: huge }), MCH)).toBe(huge);
  });

  it('returns zero for an ADA-only wallet', () => {
    const cbor = balance({ lovelace: 3_000_000n });
    expect(assetQuantity(cbor, MCH)).toBe(0n);
    expect(lovelace(cbor)).toBe(3_000_000n);
  });
});

describe('walletsFrom', () => {
  it('lists only objects that look like CIP-30 wallets, and drops non-data icons', () => {
    const wallets = walletsFrom({
      lace: { name: 'Lace', icon: 'data:image/svg+xml;base64,AA', enable: async () => ({}) },
      eternl: { name: 'Eternl', icon: 'https://evil.example/icon.png', enable: async () => ({}) },
      nonsense: { foo: 1 },
      nullish: null,
    });
    expect(wallets.map((w) => [w.key, w.name, w.icon])).toEqual([
      ['eternl', 'Eternl', ''],
      ['lace', 'Lace', 'data:image/svg+xml;base64,AA'],
    ]);
  });

  it('returns nothing when no wallet is installed', () => {
    expect(walletsFrom(undefined)).toEqual([]);
  });
});
