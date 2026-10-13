import { Constr, Data } from '@lucid-evolution/lucid';
import { parseBasket } from '@mch/index-core';
import { describe, expect, it } from 'vitest';
import plutus from '../../../contracts/plutus.json' with { type: 'json' };
import {
  cip68DatumFromCbor,
  cip68DatumToCbor,
  oracleDatumFromCbor,
  oracleDatumToCbor,
  oracleRedeemer,
  oracleSettingsData,
  tokenRedeemer,
} from '../src/codec.ts';

type Def = { anyOf?: Array<{ title: string; index: number; fields: unknown[] }> };
const defs = plutus.definitions as Record<string, Def>;
const constructors = (name: string) =>
  Object.fromEntries(
    (defs[`mch/types/${name}`]!.anyOf ?? []).map((c) => [
      c.title,
      { index: c.index, arity: c.fields.length },
    ]),
  );

const shape = (cbor: string) => {
  const d = Data.from(cbor) as Constr<unknown>;
  return { index: d.index, arity: d.fields.length };
};

describe('encodings match contracts/plutus.json', () => {
  it('oracle redeemers', () => {
    expect(constructors('OracleMint')).toEqual({
      Create: shape(oracleRedeemer.create()),
      Destroy: shape(oracleRedeemer.destroy()),
    });
    expect(constructors('OracleSpend')).toEqual({
      Update: shape(oracleRedeemer.update()),
      RotateOperator: shape(oracleRedeemer.rotateOperator('ab')),
      Close: shape(oracleRedeemer.close()),
    });
  });

  it('token redeemers', () => {
    expect(constructors('TokenMint')).toEqual({
      MintSupply: shape(tokenRedeemer.mintSupply()),
      Burn: shape(tokenRedeemer.burn()),
    });
    expect(constructors('TokenSpend')).toEqual({
      UpdateMetadata: shape(tokenRedeemer.updateMetadata()),
      Reclaim: shape(tokenRedeemer.reclaim()),
    });
  });

  it('oracle settings and datum field counts', () => {
    expect(constructors('OracleDatum').OracleDatum?.arity).toBe(6);
    expect(constructors('OracleSettings').OracleSettings?.arity).toBe(5);
    const basket = parseBasket({
      name: 't',
      version: 3,
      baseDate: '2026-10-13',
      components: [{ metal: 'XAU', weightPpm: 1_000_000, basePrice: '4000' }],
    });
    const settings = oracleSettingsData({
      admin: 'aa',
      seed: { txHash: 'bb', outputIndex: 2 },
      basket,
      maxValidityMs: 600_000,
    });
    expect(settings).toEqual(
      new Constr(0, [
        'aa',
        new Constr(0, ['bb', 2n]),
        3n,
        [new Constr(0, ['584155', 1_000_000n, 4_000_000_000n])],
        600_000n,
      ]),
    );
  });
});

describe('round trips', () => {
  it('oracle datum', () => {
    const datum = {
      indexMicro: 101_750_000n,
      pricesMicro: [4_400_000_000n, 45_600_000n, 1_632_000_000n, 15_500_000_000n],
      publishedAt: 1_791_926_152_000,
      sequence: 42,
      basketVersion: 1,
      operator: 'bb000000000000000000000000000000000000000000000000000002',
    };
    expect(oracleDatumFromCbor(oracleDatumToCbor(datum))).toEqual(datum);
  });

  it('rejects data that is not an oracle datum', () => {
    expect(() => oracleDatumFromCbor(Data.to(new Constr(1, [])))).toThrow(
      /not an MCH oracle datum/,
    );
  });

  it('CIP-68 metadata', () => {
    const meta = {
      name: 'Metal Chain',
      description: 'd',
      ticker: 'MCH',
      decimals: 6,
      url: 'https://example.org',
    };
    expect(cip68DatumFromCbor(cip68DatumToCbor(meta))).toEqual({ metadata: meta, version: 1 });
  });
});
