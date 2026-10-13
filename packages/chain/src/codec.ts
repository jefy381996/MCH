/**
 * Plutus Data encodings for every on-chain type in contracts/lib/mch/types.ak.
 * Constructor indexes and field order must match the Aiken definitions
 * exactly; test/codec.test.ts checks them against contracts/plutus.json.
 */
import { Constr, Data, fromText, toText } from '@lucid-evolution/lucid';
import { isMetalId, type Basket, type MetalId } from '@mch/index-core';

export interface OutRef {
  txHash: string;
  outputIndex: number;
}

export interface OracleSettings {
  /** Payment key hash of the cold admin key. */
  admin: string;
  seed: OutRef;
  basket: Basket;
  maxValidityMs: number;
}

/** Decoded oracle datum. Times are POSIX milliseconds. */
export interface OracleDatum {
  indexMicro: bigint;
  pricesMicro: bigint[];
  publishedAt: number;
  sequence: number;
  basketVersion: number;
  operator: string;
}

export interface TokenSettings {
  admin: string;
  seed: OutRef;
  /** Asset name as text, without the CIP-67 label, e.g. "MCH". */
  name: string;
  supply: bigint;
}

export interface TokenMetadata {
  name: string;
  description: string;
  ticker: string;
  decimals: number;
  url?: string;
  /** URI of the logo image, e.g. ipfs://... */
  logo?: string;
}

const outRef = (r: OutRef) => new Constr(0, [r.txHash, BigInt(r.outputIndex)]);

export function oracleSettingsData(s: OracleSettings): Data {
  return new Constr(0, [
    s.admin,
    outRef(s.seed),
    BigInt(s.basket.version),
    s.basket.components.map(
      (c) => new Constr(0, [fromText(c.metal), BigInt(c.weightPpm), c.basePriceMicro]),
    ),
    BigInt(s.maxValidityMs),
  ]);
}

export function oracleDatumToCbor(d: OracleDatum): string {
  return Data.to(
    new Constr(0, [
      d.indexMicro,
      d.pricesMicro,
      BigInt(d.publishedAt),
      BigInt(d.sequence),
      BigInt(d.basketVersion),
      d.operator,
    ]),
  );
}

function expectBigint(value: unknown, field: string): bigint {
  if (typeof value !== 'bigint') throw new TypeError(`oracle datum: ${field} is not an integer`);
  return value;
}

export function oracleDatumFromCbor(cbor: string): OracleDatum {
  const data = Data.from(cbor);
  if (!(data instanceof Constr) || data.index !== 0 || data.fields.length !== 6) {
    throw new TypeError('not an MCH oracle datum');
  }
  const [index, prices, publishedAt, sequence, basketVersion, operator] = data.fields;
  if (!Array.isArray(prices)) throw new TypeError('oracle datum: prices is not a list');
  if (typeof operator !== 'string') throw new TypeError('oracle datum: operator is not bytes');
  return {
    indexMicro: expectBigint(index, 'index'),
    pricesMicro: prices.map((p, i) => expectBigint(p, `prices[${i}]`)),
    publishedAt: Number(expectBigint(publishedAt, 'published_at')),
    sequence: Number(expectBigint(sequence, 'sequence')),
    basketVersion: Number(expectBigint(basketVersion, 'basket_version')),
    operator,
  };
}

/** Prices keyed by metal, using the basket's order. */
export function pricesByMetal(
  basket: Basket,
  pricesMicro: bigint[],
): Partial<Record<MetalId, bigint>> {
  return Object.fromEntries(basket.components.map((c, i) => [c.metal, pricesMicro[i]]));
}

export const oracleRedeemer = {
  create: () => Data.to(new Constr(0, [])),
  destroy: () => Data.to(new Constr(1, [])),
  update: () => Data.to(new Constr(0, [])),
  rotateOperator: (newOperator: string) => Data.to(new Constr(1, [newOperator])),
  close: () => Data.to(new Constr(2, [])),
};

export function tokenSettingsData(s: TokenSettings): Data {
  return new Constr(0, [s.admin, outRef(s.seed), fromText(s.name), s.supply]);
}

export const tokenRedeemer = {
  mintSupply: () => Data.to(new Constr(0, [])),
  burn: () => Data.to(new Constr(1, [])),
  updateMetadata: () => Data.to(new Constr(0, [])),
  reclaim: () => Data.to(new Constr(1, [])),
};

/** CIP-68 datum: Constr 0 [metadata map, version, extra]. */
export function cip68DatumToCbor(m: TokenMetadata, version = 1): string {
  const metadata = new Map<Data, Data>([
    [fromText('name'), fromText(m.name)],
    [fromText('description'), fromText(m.description)],
    [fromText('ticker'), fromText(m.ticker)],
    [fromText('decimals'), BigInt(m.decimals)],
  ]);
  if (m.url) metadata.set(fromText('url'), fromText(m.url));
  if (m.logo) metadata.set(fromText('logo'), fromText(m.logo));
  return Data.to(new Constr(0, [metadata, BigInt(version), new Constr(0, [])]));
}

export function cip68DatumFromCbor(cbor: string): {
  metadata: Record<string, string | number>;
  version: number;
} {
  const data = Data.from(cbor);
  if (!(data instanceof Constr) || !(data.fields[0] instanceof Map))
    throw new TypeError('not a CIP-68 datum');
  const metadata: Record<string, string | number> = {};
  for (const [k, v] of data.fields[0]) {
    if (typeof k !== 'string') continue;
    metadata[toText(k)] =
      typeof v === 'bigint' ? Number(v) : typeof v === 'string' ? toText(v) : '';
  }
  return { metadata, version: Number(data.fields[1] as bigint) };
}

export function metalsOf(basket: Basket): MetalId[] {
  return basket.components.map((c) => {
    if (!isMetalId(c.metal)) throw new TypeError(`unknown metal ${String(c.metal)}`);
    return c.metal;
  });
}
