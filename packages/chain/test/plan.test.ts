import { describe, expect, it } from 'vitest';
import { planDeployment, requireOracle, type Deployment } from '../src/deployment.ts';

const base: Deployment = { network: 'Mainnet', deployedAt: '', blueprint: {} };
const token = { policyId: 'aa'.repeat(28) } as NonNullable<Deployment['token']>;
const oracle = { policyId: 'bb'.repeat(28) } as NonNullable<Deployment['oracle']>;

describe('planDeployment', () => {
  it('coin only, on a fresh network: mint the coin, no oracle', () => {
    expect(planDeployment(null, { tokenOnly: true })).toEqual({
      ok: true,
      mintToken: true,
      createOracle: false,
    });
  });

  it('never mints a second coin', () => {
    const plan = planDeployment({ ...base, token }, { tokenOnly: true });
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.reason).toMatch(/second, different coin/);
    expect(planDeployment({ ...base, token, oracle }, { tokenOnly: true }).ok).toBe(false);
  });

  it('full deploy on a fresh network creates both', () => {
    expect(planDeployment(null, { tokenOnly: false })).toEqual({
      ok: true,
      mintToken: true,
      createOracle: true,
    });
  });

  it('full deploy after a coin-only run adds just the oracle', () => {
    expect(planDeployment({ ...base, token }, { tokenOnly: false })).toEqual({
      ok: true,
      mintToken: false,
      createOracle: true,
    });
  });

  it('full deploy after an oracle-only run adds just the coin', () => {
    expect(planDeployment({ ...base, oracle }, { tokenOnly: false })).toEqual({
      ok: true,
      mintToken: true,
      createOracle: false,
    });
  });

  it('refuses when everything already exists', () => {
    expect(planDeployment({ ...base, token, oracle }, { tokenOnly: false }).ok).toBe(false);
  });
});

describe('requireOracle', () => {
  it('explains what to do when there is no oracle yet', () => {
    expect(() => requireOracle({ ...base, token })).toThrow(/no oracle yet/);
    expect(requireOracle({ ...base, oracle })).toBe(oracle);
  });
});
