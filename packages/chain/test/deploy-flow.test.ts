/**
 * The path that spends real ADA, run end to end on an emulated ledger with
 * the real compiled contracts: wallet checks, confirmation, minting, saving
 * the record, recovering from interrupted runs, and the guards against ever
 * making a second coin.
 */
import {
  Emulator,
  generateEmulatorAccount,
  getAddressDetails,
  Lucid,
  type EmulatorAccount,
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

/** An emulator whose next N submissions fail, like a provider hiccup. */
class FlakyEmulator extends Emulator {
  failures = 0;
  override async submitTx(tx: string): Promise<string> {
    if (this.failures > 0) {
      this.failures--;
      throw new Error('network blip while sending');
    }
    return super.submitTx(tx);
  }
}

/** `funds`: total lovelace, or the exact UTxO sizes the admin wallet should end up holding. */
async function setup(funds: bigint | bigint[] = 50_000_000n) {
  const shaped = Array.isArray(funds);
  const start = shaped ? funds.reduce((a, b) => a + b, 0n) + 5_000_000n : funds;
  const admin = generateEmulatorAccount({ lovelace: start });
  const operator = generateEmulatorAccount({ lovelace: 10_000_000n });
  const emulator = new FlakyEmulator([admin, operator]);
  const lucid = await Lucid(emulator, 'Custom');
  emulator.awaitBlock(15);
  lucid.selectWallet.fromSeed(admin.seedPhrase);
  if (shaped) await reshape(lucid, admin, funds, emulator);
  const saved: Deployment[] = [];
  const logs: string[] = [];
  const summaries: string[] = [];
  const run = (over: Partial<DeployRun> = {}): DeployRun => ({
    lucid,
    network: 'Custom',
    existing: null,
    plan: { token: 'create', oracle: 'none' },
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
    // Each wait lets the emulated chain produce a block, like real time passing.
    sleep: async () => emulator.awaitBlock(1),
    pollIntervalMs: 20_000,
    ...over,
  });
  const wallet = async () => {
    const utxos = await lucid.utxosAt(admin.address);
    return {
      lovelace: utxos.reduce((s, u) => s + (u.assets.lovelace ?? 0n), 0n),
      coins: existingCoins(utxos, 'MCH'),
    };
  };
  return { emulator, lucid, admin, run, saved, logs, summaries, wallet };
}

/** Re-shape the admin wallet into UTxOs of exactly these sizes (the rest is sent away). */
async function reshape(
  lucid: Awaited<ReturnType<typeof Lucid>>,
  admin: EmulatorAccount,
  amounts: bigint[],
  emulator: Emulator,
) {
  const sink = generateEmulatorAccount({ lovelace: 0n });
  let tx = lucid.newTx();
  for (const a of amounts) tx = tx.pay.ToAddress(admin.address, { lovelace: a });
  const signed = await (
    await tx.complete({ changeAddress: sink.address })
  ).sign
    .withWallet()
    .complete();
  await signed.submit();
  emulator.awaitBlock(1);
}

describe('runDeploy: creating the coin', () => {
  it('records the coin before sending it, then marks it confirmed', async () => {
    const { run, saved, summaries, wallet } = await setup();
    const outcome = await runDeploy(run());
    expect(outcome.kind).toBe('done');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatch(/Total supply 100,000,000 coins, 6 decimal places/);
    expect(summaries[0]).toMatch(/PERMANENT/);
    expect(saved.map((d) => d.token?.status)).toEqual(['submitted', 'confirmed']);
    const record = saved.at(-1)!;
    expect(record.oracle).toBeUndefined();
    expect(record.token).toMatchObject({ name: 'MCH', supply: '100000000000000', decimals: 6 });
    expect((await wallet()).coins).toEqual([record.token!.policyId]);
  });

  it('sends nothing when the confirmation is declined', async () => {
    const { run, saved, wallet } = await setup();
    const before = await wallet();
    expect(await runDeploy(run({ confirm: async () => false }))).toEqual({ kind: 'cancelled' });
    expect(saved).toEqual([]);
    expect(await wallet()).toEqual(before);
  });

  it('refuses before asking when the wallet is short of ADA', async () => {
    const { run, summaries } = await setup(8_000_000n);
    const outcome = await runDeploy(run());
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(
      /holds 8 ADA; send it at least 10 ADA/,
    );
    expect(summaries).toEqual([]);
  });

  it('turns a transaction it cannot build into a plain message, with nothing sent or recorded', async () => {
    // One 5.5 ADA UTxO: enough for the fee, not for the outputs' minimum ADA.
    const { run, saved, wallet } = await setup([5_500_000n]);
    const before = await wallet();
    const outcome = await runDeploy(run({ coinBudgetLovelace: 1_000_000n }));
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(
      /Could not build the transaction, so nothing was sent/,
    );
    expect(saved).toEqual([]);
    expect(await wallet()).toEqual(before);
  });

  it('refuses to make a second coin even if the record file was lost', async () => {
    const { run, summaries, wallet } = await setup();
    await runDeploy(run());
    const outcome = await runDeploy(run({ existing: null }));
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(/already holds an MCH coin/);
    expect(summaries).toHaveLength(1); // the second run never reached the confirmation
    expect((await wallet()).coins).toHaveLength(1);
  });

  it('makes a second, different coin only when explicitly allowed', async () => {
    const { run, wallet } = await setup();
    await runDeploy(run());
    expect((await runDeploy(run({ allowSecondCoin: true }))).kind).toBe('done');
    const coins = (await wallet()).coins;
    expect(coins).toHaveLength(2);
    expect(coins[0]).not.toBe(coins[1]);
  });
});

describe('runDeploy: interrupted runs', () => {
  it('reports "pending" if confirmation is slow, and a later run finishes without spending again', async () => {
    const { emulator, run, saved, summaries, wallet } = await setup();
    // Time passes but no block is produced: the network never confirms in time.
    let t = emulator.now();
    const slow = await runDeploy(
      run({ now: () => t, sleep: async (ms) => void (t += ms), confirmTimeoutMs: 60_000 }),
    );
    expect(slow).toMatchObject({ kind: 'pending', what: 'coin' });
    const record = saved.at(-1)!;
    expect(record.token?.status).toBe('submitted');

    emulator.awaitBlock(1); // the network catches up
    const spentSoFar = await wallet();
    const resumed = await runDeploy(
      run({ existing: record, plan: { token: 'resume', oracle: 'none' } }),
    );
    expect(resumed.kind).toBe('done');
    expect(saved.at(-1)!.token).toEqual({ ...record.token, status: 'confirmed' });
    expect(summaries).toHaveLength(1); // nothing new to confirm, nothing spent
    expect(await wallet()).toEqual(spentSoFar);
    expect(spentSoFar.coins).toEqual([record.token!.policyId]);
  });

  it('if sending failed, a later run resends with the same seed and gets exactly the recorded coin', async () => {
    const { emulator, run, saved, wallet } = await setup();
    emulator.failures = 1;
    const failed = await runDeploy(run());
    expect(failed).toMatchObject({ kind: 'pending', what: 'coin' });
    expect(failed.kind === 'pending' && failed.sendError).toMatch(/network blip while sending/);
    const record = saved.at(-1)!;
    expect(record.token?.status).toBe('submitted');
    expect((await wallet()).coins).toEqual([]);

    // Even if .env now says something else, the resend rebuilds the recorded coin.
    const resumed = await runDeploy(
      run({
        existing: record,
        plan: { token: 'resume', oracle: 'none' },
        coin: { ...run().coin, wholeSupply: 5n },
      }),
    );
    expect(resumed.kind).toBe('done');
    const coins = (await wallet()).coins;
    expect(coins).toEqual([record.token!.policyId]);
    expect(saved.at(-1)!.token).toMatchObject({
      policyId: record.token!.policyId,
      supply: '100000000000000',
    });
  });

  it('never resends when the seed is gone but the coin cannot be seen yet', async () => {
    const { lucid, admin, emulator, run, saved, summaries, wallet } = await setup();
    emulator.failures = 1;
    await runDeploy(run());
    const record = saved.at(-1)!;
    // Spend the seed elsewhere: from here on, the recorded mint can never land.
    const [seedUtxo] = await lucid.utxosByOutRef([record.token!.seed]);
    const move = await lucid
      .newTx()
      .collectFrom([seedUtxo!])
      .pay.ToAddress(admin.address, { lovelace: 2_000_000n })
      .complete();
    await (await move.sign.withWallet().complete()).submit();
    emulator.awaitBlock(1);

    const outcome = await runDeploy(
      run({ existing: record, plan: { token: 'resume', oracle: 'none' } }),
    );
    expect(outcome).toMatchObject({ kind: 'pending', what: 'coin', txHash: record.token!.mintTx });
    expect(summaries).toHaveLength(1);
    expect((await wallet()).coins).toEqual([]);
  });
});

describe('runDeploy: adding the oracle later', () => {
  it('creates only the oracle when the coin already exists, keeping the coin record', async () => {
    const { run, saved, wallet } = await setup();
    const first = await runDeploy(run());
    const coinRecord = first.kind === 'done' ? first.deployment : null;

    const second = await runDeploy(
      run({ existing: coinRecord, plan: { token: 'none', oracle: 'create' } }),
    );
    expect(second.kind).toBe('done');
    const both = saved.at(-1)!;
    expect(both.token).toEqual(coinRecord!.token);
    expect(both.oracle).toMatchObject({ status: 'confirmed' });
    expect(both.oracle?.referenceScript).toBeDefined();
    expect((await wallet()).coins).toHaveLength(1);
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
