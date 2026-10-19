/**
 * The path that spends real ADA, run end to end on an emulated ledger with
 * the real compiled contracts: wallet checks, confirmation, minting, saving
 * the record, recovering from interrupted runs, and the guards against ever
 * making a second coin.
 */
import {
  CML,
  Emulator,
  generateEmulatorAccount,
  getAddressDetails,
  Lucid,
  paymentCredentialOf,
  type Credential,
  type EmulatorAccount,
  type UTxO,
} from '@lucid-evolution/lucid';
import { parseBasket } from '@mch/index-core';
import { describe, expect, it } from 'vitest';
import { scriptStore } from '../src/blueprint.ts';
import { deploySummary, runDeploy, type DeployRun } from '../src/deploy-flow.ts';
import { planDeployment, type Deployment } from '../src/deployment.ts';
import { cip68Coins, mintToken } from '../src/token-ops.ts';

const basketFile = {
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
};
const basket = parseBasket(basketFile);

const matches = (address: string, at: string | Credential) =>
  typeof at === 'string' ? address === at : paymentCredentialOf(address).hash === at.hash;
const policiesIn = (utxos: UTxO[]) => [...new Set(cip68Coins(utxos).map((c) => c.policyId))];

/**
 * An emulator that answers like Koios or Blockfrost: queries show the chain
 * tip only, so a UTxO spent by a transaction still waiting in the mempool is
 * reported as unspent until a block includes it. It can also fail upcoming
 * submissions or reads, like a busy provider.
 */
class ChainTipEmulator extends Emulator {
  failSubmits = 0;
  #failReads = new Map<string, number>();
  #inFlight: UTxO[] = [];

  /** The next `times` reads at `address` fail. */
  failReadsAt(address: string, times: number) {
    this.#failReads.set(address, times);
  }

  /** Every coin policy anywhere on the confirmed ledger. */
  coinPolicies(): string[] {
    return policiesIn(
      Object.values(this.ledger)
        .filter((e) => !e.spent)
        .map((e) => e.utxo),
    );
  }

  override async submitTx(tx: string): Promise<string> {
    if (this.failSubmits > 0) {
      this.failSubmits--;
      throw new Error('network blip while sending');
    }
    const inputs = CML.Transaction.from_cbor_hex(tx).body().inputs();
    const refs = Array.from({ length: inputs.len() }, (_, i) => ({
      txHash: inputs.get(i).transaction_id().to_hex(),
      outputIndex: Number(inputs.get(i).index()),
    }));
    const spending = await super.getUtxosByOutRef(refs);
    const hash = await super.submitTx(tx);
    this.#inFlight.push(...spending);
    return hash;
  }

  override awaitBlock(height = 1): void {
    super.awaitBlock(height);
    this.#inFlight = [];
  }

  override async getUtxos(at: string | Credential): Promise<UTxO[]> {
    this.#maybeFail(at);
    const waiting = this.#inFlight.filter((u) => matches(u.address, at));
    return [...(await super.getUtxos(at)), ...waiting];
  }

  override async getUtxosWithUnit(at: string | Credential, unit: string): Promise<UTxO[]> {
    this.#maybeFail(at);
    const waiting = this.#inFlight.filter(
      (u) => matches(u.address, at) && (u.assets[unit] ?? 0n) > 0n,
    );
    return [...(await super.getUtxosWithUnit(at, unit)), ...waiting];
  }

  #maybeFail(at: string | Credential) {
    for (const [address, left] of this.#failReads) {
      if (left > 0 && matches(address, at)) {
        this.#failReads.set(address, left - 1);
        throw new Error('429 Too Many Requests');
      }
    }
  }
}

/** `funds`: total lovelace, or the exact UTxO sizes the admin wallet should end up holding. */
async function setup(funds: bigint | bigint[] = 50_000_000n) {
  const shaped = Array.isArray(funds);
  const start = shaped ? funds.reduce((a, b) => a + b, 0n) + 5_000_000n : funds;
  const admin = generateEmulatorAccount({ lovelace: start });
  const operator = generateEmulatorAccount({ lovelace: 10_000_000n });
  const emulator = new ChainTipEmulator([admin, operator]);
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
      coins: policiesIn(utxos),
    };
  };
  return { emulator, lucid, admin, run, saved, logs, summaries, wallet };
}

/** Time passes but no block is produced: the network does not confirm in time. */
function stalled(emulator: Emulator): Partial<DeployRun> {
  let t = emulator.now();
  return { now: () => t, sleep: async (ms) => void (t += ms), confirmTimeoutMs: 60_000 };
}

/** A setup where the coin already exists and is recorded. */
async function withCoin() {
  const s = await setup(120_000_000n);
  const first = await runDeploy(s.run());
  if (first.kind !== 'done') throw new Error(`coin not created: ${first.kind}`);
  return { ...s, coinRecord: first.deployment };
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
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(
      /already holds a coin: MCH \(policy/,
    );
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
    emulator.failSubmits = 1;
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
    emulator.failSubmits = 1;
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

describe('runDeploy: re-running before the network has confirmed', () => {
  it('a re-run while the first send is still waiting cannot make a second coin', async () => {
    const { emulator, run, saved, summaries, logs } = await setup();
    expect(await runDeploy(run(stalled(emulator)))).toMatchObject({ kind: 'pending' });
    const first = saved.at(-1)!;

    // Re-run straight away, after editing the description: the network still shows the
    // seed as unspent, so the coin is rebuilt (with different bytes) and sent again.
    const coin = run().coin;
    const edited = { ...coin, metadata: { ...coin.metadata, description: 'Typo fixed' } };
    const second = await runDeploy(
      run({ existing: first, plan: { token: 'resume', oracle: 'none' }, coin: edited }),
    );
    expect(second).toMatchObject({ kind: 'pending', what: 'coin' });
    expect(logs).toContain('This is safe: it can only ever make this same coin, and only once.');
    expect(summaries).toHaveLength(2);
    const resent = saved.at(-1)!;
    expect(resent.token!.policyId).toBe(first.token!.policyId);
    expect(resent.token!.mintTx).not.toBe(first.token!.mintTx);

    emulator.awaitBlock(1); // the first send lands; the resend never can
    const third = await runDeploy(
      run({ existing: resent, plan: { token: 'resume', oracle: 'none' } }),
    );
    expect(third.kind).toBe('done');
    const record = saved.at(-1)!.token!;
    expect(record).toMatchObject({ status: 'confirmed', mintTx: first.token!.mintTx });
    expect(emulator.coinPolicies()).toEqual([first.token!.policyId]);
  });

  it('a quick oracle re-run records the transaction that landed and its reference script', async () => {
    const { emulator, lucid, run, saved, coinRecord } = await withCoin();
    const create = await runDeploy(
      run({
        existing: coinRecord,
        plan: { token: 'none', oracle: 'create' },
        ...stalled(emulator),
      }),
    );
    expect(create).toMatchObject({ kind: 'pending', what: 'oracle' });
    const first = saved.at(-1)!;

    // Re-run 30 seconds later, before any block: rebuilt with a new timestamp, sent again.
    const later = emulator.now() + 30_000;
    const second = await runDeploy(
      run({ existing: first, plan: { token: 'none', oracle: 'resume' }, now: () => later }),
    );
    expect(second).toMatchObject({ kind: 'pending', what: 'oracle' });
    const resent = saved.at(-1)!;
    expect(resent.oracle!.policyId).toBe(first.oracle!.policyId);
    expect(resent.oracle!.createTx).not.toBe(first.oracle!.createTx);

    emulator.awaitBlock(1);
    const third = await runDeploy(
      run({ existing: resent, plan: { token: 'none', oracle: 'resume' } }),
    );
    expect(third.kind).toBe('done');
    const oracle = saved.at(-1)!.oracle!;
    expect(oracle).toMatchObject({ status: 'confirmed', createTx: first.oracle!.createTx });
    const [script] = await lucid.utxosByOutRef([oracle.referenceScript!]);
    expect(script?.txHash).toBe(first.oracle!.createTx);
    expect(script?.scriptRef).toBeDefined();
  });

  it('refuses to resend an oracle attempt once the basket file has changed', async () => {
    const { emulator, run, saved, summaries, coinRecord } = await withCoin();
    await runDeploy(
      run({
        existing: coinRecord,
        plan: { token: 'none', oracle: 'create' },
        ...stalled(emulator),
      }),
    );
    const first = saved.at(-1)!;
    const records = saved.length;
    const asked = summaries.length;

    const changed = parseBasket({ ...basketFile, version: 2 });
    const outcome = await runDeploy(
      run({ existing: first, plan: { token: 'none', oracle: 'resume' }, basket: changed }),
    );
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(/basket file has\s+changed/);
    expect(saved).toHaveLength(records);
    expect(summaries).toHaveLength(asked);

    emulator.awaitBlock(1); // the original lands, and the unchanged record finds it
    expect(
      (await runDeploy(run({ existing: first, plan: { token: 'none', oracle: 'resume' } }))).kind,
    ).toBe('done');
    expect(saved.at(-1)!.oracle).toMatchObject({
      status: 'confirmed',
      policyId: first.oracle!.policyId,
    });
  });
});

describe('runDeploy: the second-coin guard', () => {
  it('counts a coin of any name, so a name typed differently cannot make a second coin', async () => {
    const { emulator, run } = await setup();
    await runDeploy(run());
    const coin = run().coin;
    const outcome = await runDeploy(run({ coin: { ...coin, assetName: 'Mch' } }));
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(/already holds a coin: MCH/);
    expect(emulator.coinPolicies()).toHaveLength(1);
  });

  it('does not resend an old unsent attempt once the wallet holds a different coin', async () => {
    const { emulator, lucid, run, saved, summaries } = await setup([30_000_000n, 30_000_000n]);
    emulator.failSubmits = 1;
    await runDeploy(run());
    const stale = saved.at(-1)!;
    const seed = stale.token!.seed;

    // Meanwhile a run whose record went missing made a coin from the other UTxO.
    const wallet = await lucid.wallet().getUtxos();
    const other = wallet.find(
      (u) => u.txHash !== seed.txHash || u.outputIndex !== seed.outputIndex,
    )!;
    await mintToken(lucid, {
      name: 'MCH',
      supply: 100_000_000_000_000n,
      metadata: run().coin.metadata,
      seed: other,
    });
    emulator.awaitBlock(1);
    const left = await lucid.wallet().getUtxos();
    expect(left.some((u) => u.txHash === seed.txHash && u.outputIndex === seed.outputIndex)).toBe(
      true,
    );

    const outcome = await runDeploy(
      run({ existing: stale, plan: { token: 'resume', oracle: 'none' } }),
    );
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(/already holds a coin: MCH/);
    expect(summaries).toHaveLength(1);
    expect(emulator.coinPolicies()).toHaveLength(1);
  });
});

describe('runDeploy: provider and disk problems', () => {
  it('a wallet it cannot read sends nothing, and says so', async () => {
    const { emulator, admin, run, saved, summaries } = await setup();
    emulator.failReadsAt(admin.address, 1);
    const outcome = await runDeploy(run());
    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toMatch(
      /Could not read the admin wallet from the network, so nothing was sent:\s+429/,
    );
    expect(saved).toEqual([]);
    expect(summaries).toEqual([]);
  });

  it('a failed look-up of a coin that did land reports "pending", and never resends', async () => {
    const { emulator, run, saved, summaries } = await setup();
    await runDeploy(run(stalled(emulator)));
    const record = saved.at(-1)!;
    emulator.awaitBlock(1); // it lands
    emulator.failReadsAt(record.token!.metadataAddress, 1);
    const outcome = await runDeploy(
      run({ existing: record, plan: { token: 'resume', oracle: 'none' } }),
    );
    expect(outcome).toMatchObject({ kind: 'pending', what: 'coin' });
    expect(summaries).toHaveLength(1);
    expect(emulator.coinPolicies()).toEqual([record.token!.policyId]);
  });

  it('if the record cannot be written before sending, nothing is sent', async () => {
    const { emulator, run, wallet } = await setup();
    const before = await wallet();
    const failing = run({
      save: () => {
        throw new Error('EPERM: operation not permitted');
      },
    });
    await expect(runDeploy(failing)).rejects.toThrow(/EPERM/);
    emulator.awaitBlock(1);
    expect(await wallet()).toEqual(before);
    expect(emulator.coinPolicies()).toEqual([]);
  });

  it('if the confirmed record cannot be written, a re-run completes it without spending', async () => {
    const { run, saved, wallet } = await setup();
    let writes = 0;
    const r = run();
    const failing = {
      ...r,
      save: (d: Deployment) => {
        if (++writes === 2) throw new Error('EPERM: operation not permitted');
        r.save(d);
      },
    };
    await expect(runDeploy(failing)).rejects.toThrow(/EPERM/);
    const record = saved.at(-1)!;
    expect(record.token!.status).toBe('submitted');

    const plan = planDeployment(record, { tokenOnly: true });
    if (!plan.ok) throw new Error(plan.reason);
    const spent = await wallet();
    expect((await runDeploy(run({ existing: record, plan }))).kind).toBe('done');
    expect(saved.at(-1)!.token).toMatchObject({
      status: 'confirmed',
      policyId: record.token!.policyId,
    });
    expect(await wallet()).toEqual(spent);
  });

  it('a reference script the provider would not show is added by a later run', async () => {
    const { emulator, run, saved, logs } = await setup(120_000_000n);
    emulator.failReadsAt(scriptStore('Custom').address, 3);
    const first = await runDeploy(run({ plan: { token: 'create', oracle: 'create' } }));
    expect(first.kind).toBe('done');
    const record = saved.at(-1)!;
    expect(record.oracle).toMatchObject({ status: 'confirmed' });
    expect(record.oracle!.referenceScript).toBeUndefined();
    expect(logs.join('\n')).toMatch(/Could not read the oracle's reference script yet/);

    const plan = planDeployment(record, { tokenOnly: false });
    expect(plan).toEqual({ ok: true, token: 'none', oracle: 'resume' });
    if (!plan.ok) return;
    expect((await runDeploy(run({ existing: record, plan }))).kind).toBe('done');
    const oracle = saved.at(-1)!.oracle!;
    expect(oracle.referenceScript).toBeDefined();
    expect(oracle.createTx).toBe(oracle.referenceScript!.txHash);
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
