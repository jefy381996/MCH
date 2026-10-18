import { describe, expect, it } from 'vitest';
import { planDeployment, requireOracle, type Deployment } from '../src/deployment.ts';

const base: Deployment = { network: 'Mainnet', deployedAt: '', blueprint: {} };
const token = { policyId: 'aa'.repeat(28) } as NonNullable<Deployment['token']>;
const pendingToken = { ...token, status: 'submitted' } as NonNullable<Deployment['token']>;
const oracle = { policyId: 'bb'.repeat(28) } as NonNullable<Deployment['oracle']>;
const pendingOracle = { ...oracle, status: 'submitted' } as NonNullable<Deployment['oracle']>;

describe('planDeployment', () => {
  it('coin only, on a fresh network: create the coin, no oracle', () => {
    expect(planDeployment(null, { tokenOnly: true })).toEqual({
      ok: true,
      token: 'create',
      oracle: 'none',
    });
  });

  it('never mints a second coin once one is confirmed', () => {
    const plan = planDeployment({ ...base, token }, { tokenOnly: true });
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.reason).toMatch(/second, different coin/);
    expect(planDeployment({ ...base, token, oracle }, { tokenOnly: true }).ok).toBe(false);
  });

  it('an unconfirmed coin is checked on, not minted afresh', () => {
    expect(planDeployment({ ...base, token: pendingToken }, { tokenOnly: true })).toEqual({
      ok: true,
      token: 'resume',
      oracle: 'none',
    });
  });

  it('full deploy on a fresh network creates both', () => {
    expect(planDeployment(null, { tokenOnly: false })).toEqual({
      ok: true,
      token: 'create',
      oracle: 'create',
    });
  });

  it('full deploy after a coin-only run adds just the oracle', () => {
    expect(planDeployment({ ...base, token }, { tokenOnly: false })).toEqual({
      ok: true,
      token: 'none',
      oracle: 'create',
    });
  });

  it('full deploy after an oracle-only run adds just the coin', () => {
    expect(planDeployment({ ...base, oracle }, { tokenOnly: false })).toEqual({
      ok: true,
      token: 'create',
      oracle: 'none',
    });
  });

  it('checks on an unconfirmed oracle instead of creating another', () => {
    expect(planDeployment({ ...base, token, oracle: pendingOracle }, { tokenOnly: false })).toEqual(
      {
        ok: true,
        token: 'none',
        oracle: 'resume',
      },
    );
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
