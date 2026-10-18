/**
 * The path that spends real ADA, run end to end on an emulated ledger with
 * the real compiled contracts: wallet checks, confirmation, minting, saving
 * the record, and the guards against making a second coin.
 */
import {
  Emulator,
  generateEmulatorAccount,
  getAddressDetails,
  Lucid,
} from '@lucid-evolution/lucid';
import { parseBasket } from '@mch/index-core';
import { describe, expect, it } from 'vitest';
import { deploySummary, runDeploy, type DeployRun } from '../src/deploy-flow.ts';
import type { Deployment } from '../src/deployment.ts';
import { existingCoins } from '../src/token-ops.ts';

const basket = parseBasket({
  name: 'Test basket',
  version: 1,
  baseDate: '2026-10-13',
  isDemo: true,
  components: [
    { metal: 'XAU', weightPpm: 250_000, basePrice: '4000' },
    { metal: 'XAG', weightPpm: 250_000, basePrice: '48' },
    { metal: 'XPT', weightPpm: 250_000, basePrice: '1600' },
    { metal: 'NI', weightPpm: 250_000, basePrice: '15500' },
  ],
});

async function setup(lovelace = 50_000_000n) {
  const admin = generateEmulatorAccount({ lovelace });
  const operator = generateEmulatorAccount({ lovelace: 10_000_000n });
  const emulator = new Emulator([admin, operator]);
  const lucid = await Lucid(emulator, 'Custom');
  emulator.awaitBlock(15);
  lucid.selectWallet.fromSeed(admin.seedPhrase);
  const saved: Deployment[] = [];
  const logs: string[] = [];
  const summaries: string[] = [];
  const run = (over: Partial<DeployRun> = {}): DeployRun => ({
    lucid,
    network: 'Custom',
    existing: null,
    plan: { mintToken: true, createOracle: false },
    coin: {
      assetName: 'MCH',
      wholeSupply: 100_000_000n,
      decimals: 6,
      metadata: { name: 'Metal Chain', description: 'Test coin', ticker: 'MCH', decimals: 6 },
    },
    basket,
    allowSecondCoin: false,
    confirm: async (summary) => (summaries.push(summary), true),
    operator: () => getAddressDetails(operator.address).paymentCredential!.hash,
    genesisPrices: async () => basket.components.map((c) => c.basePriceMicro),
    save: (d) => saved.push(structuredClone(d)),
    log: (line) => logs.push(line),
    now: () => emulator.now(),
    ...over,
  });
  const balance = async () => {
    const utxos = await lucid.utxosAt(admin.address);
    return {
      lovelace: utxos.reduce((s, u) => s + (u.assets.lovelace ?? 0n), 0n),
      coins: existingCoins(utxos, 'MCH'),
    };
  };
  return { emulator, lucid, run, saved, logs, summaries, balance };
}

describe('runDeploy: creating the coin', () => {
  it('shows the summary, mints the whole supply once, and saves the record', async () => {
    const { run, saved, summaries, balance } = await setup();
    const outcome = await runDeploy(run());
    expect(outcome.kind).toBe('done');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatch(/Total supply 100,000,000 coins, 6 decimal places/);
    expect(summaries[0]).toMatch(/PERMANENT/);
    expect(saved).toHaveLength(1);
    const record = saved[0]!;
    expect(record.oracle).toBeUndefined();
    expect(record.token).toMatchObject({ name: 'MCH', supply: '100000000000000', decimals: 6 });
    const after = await balance();
    expect(after.coins).toEqual([record.token!.policyId]);
  });

  it('sends nothing when the confirmation is declined', async () => {
    const { run, saved, balance } = await setup();
    const before = await balance();
    expect(await runDeploy(run({ confirm: async () => false }))).toEqual({ kind: 'cancelled' });
    expect(saved).toEqual([]);
    expect(await balance()).toEqual(before);
  });

  it('refuses before asking when the wallet is short of ADA', async () => {
    const { run, summaries } = await setup(3_000_000n);
    const outcome = await runDeploy(run());
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(
      /holds 3 ADA; send it at least 5 ADA/,
    );
    expect(summaries).toEqual([]);
  });

  it('refuses to make a second coin even if the record file was lost', async () => {
    const { run, summaries, balance } = await setup();
    await runDeploy(run());
    const outcome = await runDeploy(run({ existing: null }));
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(/already holds an MCH coin/);
    expect(summaries).toHaveLength(1); // the second run never reached the confirmation
    expect((await balance()).coins).toHaveLength(1);
  });

  it('makes a second, different coin only when explicitly allowed', async () => {
    const { run, balance } = await setup();
    await runDeploy(run());
    expect((await runDeploy(run({ allowSecondCoin: true }))).kind).toBe('done');
    const coins = (await balance()).coins;
    expect(coins).toHaveLength(2);
    expect(coins[0]).not.toBe(coins[1]);
  });
});

describe('runDeploy: adding the oracle later', () => {
  it('creates only the oracle when the coin already exists, keeping the coin record', async () => {
    const { run, saved, balance } = await setup();
    const first = await runDeploy(run());
    expect(first.kind).toBe('done');
    const coinRecord = first.kind === 'done' ? first.deployment : null;

    const second = await runDeploy(
      run({ existing: coinRecord, plan: { mintToken: false, createOracle: true } }),
    );
    expect(second.kind).toBe('done');
    const both = saved.at(-1)!;
    expect(both.token).toEqual(coinRecord!.token);
    expect(both.oracle?.referenceScript).toBeDefined();
    expect((await balance()).coins).toHaveLength(1);
  });
});

describe('deploySummary', () => {
  it('says plainly when real ADA is involved', async () => {
    const { run } = await setup();
    const text = deploySummary({ ...run(), network: 'Mainnet' }, 'addr1xyz', 12_500_000n);
    expect(text).toMatch(/REAL CARDANO \(Mainnet\): this uses real ADA/);
    expect(text).toMatch(/Balance\s+12\.5 ADA/);
    expect(text).toMatch(/Logo\s+\(none; can be added later\)/);
  });
});
