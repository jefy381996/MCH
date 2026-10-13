import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseBasket, serializeBasket, type Basket, type BasketFile } from '@mch/index-core';
import type { OutRef, OracleSettings } from './codec.ts';
import type { NetworkName } from './network.ts';

/**
 * Everything needed to find and use a deployed oracle and token. Written by
 * the deploy script, committed to the repo (it contains no secrets), and read
 * by the backend and the oracle submitter.
 */
export interface Deployment {
  network: NetworkName | 'Custom';
  deployedAt: string;
  /** Hashes of the un-parameterised validators, for auditors. */
  blueprint: Record<string, string>;
  oracle: {
    policyId: string;
    address: string;
    authUnit: string;
    admin: string;
    seed: OutRef;
    basket: BasketFile;
    maxValidityMs: number;
    referenceScript?: OutRef;
    createTx: string;
  };
  token?: {
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
  };
}

export function loadDeployment(path: string): Deployment {
  return JSON.parse(readFileSync(path, 'utf8')) as Deployment;
}

export function saveDeployment(path: string, deployment: Deployment): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(deployment, null, 2)}\n`);
}

export function oracleSettingsOf(d: Deployment): OracleSettings {
  return {
    admin: d.oracle.admin,
    seed: d.oracle.seed,
    basket: parseBasket(d.oracle.basket),
    maxValidityMs: d.oracle.maxValidityMs,
  };
}

export function basketFileOf(basket: Basket): BasketFile {
  return serializeBasket(basket);
}
