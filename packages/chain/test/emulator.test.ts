/**
 * End-to-end against Lucid's in-memory Cardano ledger. Every transaction here
 * is evaluated by the real compiled validators from contracts/plutus.json, so
 * a rejection in these tests is the chain itself saying no.
 */
import {
  Emulator,
  generateEmulatorAccount,
  getAddressDetails,
  Lucid,
  type EmulatorAccount,
  type LucidEvolution,
} from '@lucid-evolution/lucid';
import { parseBasket, serializeBasket } from '@mch/index-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { blueprintHashes, oracleScript } from '../src/blueprint.ts';
import {
  cip68DatumFromCbor,
  oracleDatumToCbor,
  oracleRedeemer,
  tokenRedeemer,
} from '../src/codec.ts';
import type { Deployment } from '../src/deployment.ts';
import {
  closeOracle,
  createOracle,
  findReferenceScript,
  publishUpdate,
  readFeed,
  rotateOperator,
  walletKeyHash,
} from '../src/oracle-ops.ts';
import { mintToken } from '../src/token-ops.ts';
import { createOracleReader } from '../src/reader.ts';

const basket = parseBasket({
  name: 'Test basket',
  version: 1,
  baseDate: '2026-10-13',
  components: [
    { metal: 'XAU', weightPpm: 250_000, basePrice: '4000' },
    { metal: 'XAG', weightPpm: 250_000, basePrice: '48' },
    { metal: 'XPT', weightPpm: 250_000, basePrice: '1600' },
    { metal: 'NI', weightPpm: 250_000, basePrice: '15500' },
  ],
});
/** What the ledger rules say when a validator rejects a transaction. */
const SCRIPT_FAILED = /failed script execution/;

const BASE = [4_000_000_000n, 48_000_000n, 1_600_000_000n, 15_500_000_000n];
const MOVED = [4_400_000_000n, 45_600_000n, 1_632_000_000n, 15_500_000_000n];

const keyHash = (account: EmulatorAccount) =>
  getAddressDetails(account.address).paymentCredential!.hash;

let emulator: Emulator;
let lucid: LucidEvolution;
let admin: EmulatorAccount;
let operator: EmulatorAccount;
let newOperator: EmulatorAccount;
let holder: EmulatorAccount;
let deployment: Deployment;

const as = (account: EmulatorAccount) => lucid.selectWallet.fromSeed(account.seedPhrase);
const confirm = () => emulator.awaitBlock(1);

beforeAll(async () => {
  admin = generateEmulatorAccount({ lovelace: 2_000_000_000n });
  operator = generateEmulatorAccount({ lovelace: 200_000_000n });
  newOperator = generateEmulatorAccount({ lovelace: 200_000_000n });
  holder = generateEmulatorAccount({ lovelace: 50_000_000n });
  emulator = new Emulator([admin, operator, newOperator, holder]);
  lucid = await Lucid(emulator, 'Custom');
  // Start a few minutes in, so "one minute ago" is a valid slot.
  emulator.awaitBlock(15);

  as(admin);
  const created = await createOracle(lucid, {
    basket,
    operator: keyHash(operator),
    pricesMicro: BASE,
    now: emulator.now(),
    publishReferenceScript: true,
  });
  confirm();
  deployment = {
    network: 'Custom',
    deployedAt: new Date(emulator.now()).toISOString(),
    blueprint: blueprintHashes(),
    oracle: {
      policyId: created.policyId,
      address: created.address,
      authUnit: created.authUnit,
      admin: created.settings.admin,
      seed: created.settings.seed,
      basket: serializeBasket(basket),
      maxValidityMs: created.settings.maxValidityMs,
      referenceScript: await findReferenceScript(lucid, created.txHash),
      createTx: created.txHash,
    },
  };
});

/** Builds an update by hand so tests can break one rule at a time. */
async function attemptUpdate(o: {
  signer: EmulatorAccount;
  index?: bigint;
  sequenceDelta?: number;
  publishedAt?: number;
  validity?: [number, number];
}) {
  as(o.signer);
  const { utxo, datum } = await readFeed(lucid, deployment);
  const now = emulator.now();
  const next = {
    ...datum,
    indexMicro: o.index ?? datum.indexMicro,
    sequence: datum.sequence + (o.sequenceDelta ?? 1),
    publishedAt: o.publishedAt ?? now,
  };
  const [from, to] = o.validity ?? [now - 60_000, now + 240_000];
  return lucid
    .newTx()
    .collectFrom([utxo], oracleRedeemer.update())
    .readFrom(await lucid.utxosByOutRef([deployment.oracle.referenceScript!]))
    .pay.ToContract(
      deployment.oracle.address,
      { kind: 'inline', value: oracleDatumToCbor(next) },
      { lovelace: utxo.assets.lovelace!, [deployment.oracle.authUnit]: 1n },
    )
    .addSignerKey(keyHash(o.signer))
    .validFrom(from)
    .validTo(to)
    .complete();
}

describe('oracle on the emulated ledger', () => {
  it('was created with the genesis datum and a reference script', async () => {
    const { datum, utxo } = await readFeed(lucid, deployment);
    expect(datum).toMatchObject({
      indexMicro: 100_000_000n,
      sequence: 0,
      operator: keyHash(operator),
    });
    expect(utxo.assets[deployment.oracle.authUnit]).toBe(1n);
    expect(deployment.oracle.referenceScript).toBeDefined();
    expect(deployment.oracle.policyId).toBe(oracleScript({ ...created(), basket }, 'Custom').hash);
  });

  it('accepts a valid update from the operator', async () => {
    as(operator);
    const result = await publishUpdate(lucid, deployment, {
      pricesMicro: MOVED,
      now: emulator.now(),
    });
    confirm();
    const { datum } = await readFeed(lucid, deployment);
    expect(datum.indexMicro).toBe(101_750_000n);
    expect(datum.sequence).toBe(1);
    expect(datum).toEqual(result.datum);
  });

  it('rejects an index that does not match the posted prices', async () => {
    await expect(attemptUpdate({ signer: operator, index: 123_000_000n })).rejects.toThrow(
      SCRIPT_FAILED,
    );
  });

  it('rejects an update signed by anyone but the operator, admin included', async () => {
    await expect(attemptUpdate({ signer: holder })).rejects.toThrow(SCRIPT_FAILED);
    await expect(attemptUpdate({ signer: admin })).rejects.toThrow(SCRIPT_FAILED);
  });

  it('rejects a skipped or replayed sequence number', async () => {
    await expect(attemptUpdate({ signer: operator, sequenceDelta: 2 })).rejects.toThrow(
      SCRIPT_FAILED,
    );
    await expect(attemptUpdate({ signer: operator, sequenceDelta: 0 })).rejects.toThrow(
      SCRIPT_FAILED,
    );
  });

  it('rejects a timestamp outside the validity range and an over-wide range', async () => {
    const now = emulator.now();
    await expect(attemptUpdate({ signer: operator, publishedAt: now + 600_000 })).rejects.toThrow(
      SCRIPT_FAILED,
    );
    await expect(
      attemptUpdate({ signer: operator, validity: [now - 60_000, now + 11 * 60_000] }),
    ).rejects.toThrow(SCRIPT_FAILED);
  });

  it('accepts the control case built by the same helper', async () => {
    emulator.awaitBlock(3);
    const tx = await attemptUpdate({ signer: operator });
    await (await tx.sign.withWallet().complete()).submit();
    confirm();
    expect((await readFeed(lucid, deployment)).datum.sequence).toBe(2);
  });

  it('is readable by the backend through a keyless reader', async () => {
    const status = await createOracleReader(deployment, emulator).read();
    const { utxo, datum } = await readFeed(lucid, deployment);
    expect(status).toMatchObject({
      index: '101.750000',
      sequence: datum.sequence,
      basketVersion: 1,
      txHash: utxo.txHash,
      prices: { XAU: '4400.000000', XAG: '45.600000', XPT: '1632.000000', NI: '15500.000000' },
      token: null,
    });
  });

  it('lets the admin rotate the operator key; the old key stops working', async () => {
    as(admin);
    await rotateOperator(lucid, deployment, keyHash(newOperator));
    confirm();
    emulator.awaitBlock(3);
    as(operator);
    await expect(
      publishUpdate(lucid, deployment, { pricesMicro: BASE, now: emulator.now() }),
    ).rejects.toThrow(/not the current oracle operator/);
    await expect(attemptUpdate({ signer: operator })).rejects.toThrow(SCRIPT_FAILED);
    as(newOperator);
    await publishUpdate(lucid, deployment, { pricesMicro: BASE, now: emulator.now() });
    confirm();
    const { datum } = await readFeed(lucid, deployment);
    expect(datum).toMatchObject({
      indexMicro: 100_000_000n,
      sequence: 3,
      operator: keyHash(newOperator),
    });
  });
});

function created() {
  return {
    admin: deployment.oracle.admin,
    seed: deployment.oracle.seed,
    maxValidityMs: deployment.oracle.maxValidityMs,
  };
}

describe('MCH token on the emulated ledger', () => {
  const SUPPLY = 100_000_000n * 1_000_000n;
  let token: Awaited<ReturnType<typeof mintToken>>;

  beforeAll(async () => {
    as(admin);
    token = await mintToken(lucid, {
      name: 'MCH',
      supply: SUPPLY,
      metadata: {
        name: 'Metal Chain',
        description: 'Tracks a basket of four metals',
        ticker: 'MCH',
        decimals: 6,
      },
    });
    confirm();
  });

  it('mints the fixed supply to the admin and parks the reference NFT with CIP-68 metadata', async () => {
    const adminUtxos = await lucid.utxosAt(admin.address);
    const balance = adminUtxos.reduce((sum, u) => sum + (u.assets[token.fungibleUnit] ?? 0n), 0n);
    expect(balance).toBe(SUPPLY);
    const [ref] = await lucid.utxosAtWithUnit(token.metadataAddress, token.referenceUnit);
    expect(cip68DatumFromCbor(ref!.datum!)).toEqual({
      metadata: {
        name: 'Metal Chain',
        description: 'Tracks a basket of four metals',
        ticker: 'MCH',
        decimals: 6,
      },
      version: 1,
    });
    expect(token.fungibleUnit.slice(56, 64)).toBe('0014df10');
    expect(token.referenceUnit.slice(56, 64)).toBe('000643b0');
  });

  it('can never mint more, even with the admin key', async () => {
    as(admin);
    const { script } = await import('../src/blueprint.ts').then((m) =>
      m.tokenScript(token.settings, 'Custom'),
    );
    await expect(
      lucid
        .newTx()
        .mintAssets({ [token.fungibleUnit]: 1_000n }, tokenRedeemer.mintSupply())
        .attach.MintingPolicy(script)
        .addSignerKey(await walletKeyHash(lucid))
        .complete(),
    ).rejects.toThrow(SCRIPT_FAILED);
  });

  it('lets a holder burn their own tokens', async () => {
    as(admin);
    const send = await lucid
      .newTx()
      .pay.ToAddress(holder.address, { [token.fungibleUnit]: 5_000_000n })
      .complete();
    await (await send.sign.withWallet().complete()).submit();
    confirm();

    as(holder);
    const { script } = await import('../src/blueprint.ts').then((m) =>
      m.tokenScript(token.settings, 'Custom'),
    );
    const burn = await lucid
      .newTx()
      .mintAssets({ [token.fungibleUnit]: -2_000_000n }, tokenRedeemer.burn())
      .attach.MintingPolicy(script)
      .complete();
    await (await burn.sign.withWallet().complete()).submit();
    confirm();
    const left = (await lucid.utxosAt(holder.address)).reduce(
      (s, u) => s + (u.assets[token.fungibleUnit] ?? 0n),
      0n,
    );
    expect(left).toBe(3_000_000n);
  });
});

describe('closing the oracle', () => {
  it('only the admin can close, and closing burns the auth NFT', async () => {
    as(newOperator);
    await expect(closeOracle(lucid, deployment)).rejects.toThrow(SCRIPT_FAILED);
    as(admin);
    await closeOracle(lucid, deployment);
    confirm();
    await expect(readFeed(lucid, deployment)).rejects.toThrow(/found 0/);
  });
});
