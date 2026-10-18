import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseBasket, serializeBasket, type Basket, type BasketFile } from '@mch/index-core';
import type { OutRef, OracleSettings } from './codec.ts';
import type { NetworkName } from './network.ts';

export interface OracleDeployment {
  policyId: string;
  address: string;
  authUnit: string;
  admin: string;
  seed: OutRef;
  basket: BasketFile;
  maxValidityMs: number;
  referenceScript?: OutRef;
  createTx: string;
}

export interface TokenDeployment {
  policyId: string;
  name: string;
  referenceUnit: string;
  fungibleUnit: string;
  supply: string;
  decimals: number;
  admin: string;
  seed: OutRef;
  metadataAddress: string;
  mintTx: string;
}

/**
 * Everything needed to find and use the deployed token and oracle. Written by
 * the deploy script, committed to the repo (it contains no secrets), and read
 * by the backend and the oracle submitter. Either part can exist on its own:
 * the coin can be created before there is a real price feed for the oracle.
 */
export interface Deployment {
  network: NetworkName | 'Custom';
  deployedAt: string;
  /** Hashes of the un-parameterised validators, for auditors. */
  blueprint: Record<string, string>;
  oracle?: OracleDeployment;
  token?: TokenDeployment;
}

/** The oracle part of a deployment, or a clear error if it has not been created yet. */
export function requireOracle(d: Deployment): OracleDeployment {
  if (!d.oracle) {
    throw new Error('This deployment has no oracle yet. Create it with `npm run chain:deploy`.');
  }
  return d.oracle;
}

export type DeployPlan =
  { ok: true; mintToken: boolean; createOracle: boolean } | { ok: false; reason: string };

/**
 * Decides what a deploy run may do, given what already exists. Its main job
 * is to make a second coin impossible by accident: every run of the mint
 * creates a brand-new, different coin, so once one exists the answer is no.
 */
export function planDeployment(existing: Deployment | null, o: { tokenOnly: boolean }): DeployPlan {
  const hasToken = !!existing?.token;
  const hasOracle = !!existing?.oracle;
  if (o.tokenOnly) {
    if (hasToken) {
      return {
        ok: false,
        reason: `The MCH coin already exists (policy ${existing!.token!.policyId}). Creating it again would make a second, different coin.`,
      };
    }
    return { ok: true, mintToken: true, createOracle: false };
  }
  if (hasToken && hasOracle) {
    return {
      ok: false,
      reason: 'Both the coin and the oracle already exist. There is nothing to deploy.',
    };
  }
  return { ok: true, mintToken: !hasToken, createOracle: !hasOracle };
}

export function loadDeployment(path: string): Deployment {
  return JSON.parse(readFileSync(path, 'utf8')) as Deployment;
}

export function saveDeployment(path: string, deployment: Deployment): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(deployment, null, 2)}\n`);
}

export function oracleSettingsOf(d: Deployment): OracleSettings {
  const oracle = requireOracle(d);
  return {
    admin: oracle.admin,
    seed: oracle.seed,
    basket: parseBasket(oracle.basket),
    maxValidityMs: oracle.maxValidityMs,
  };
}

export function basketFileOf(basket: Basket): BasketFile {
  return serializeBasket(basket);
}
