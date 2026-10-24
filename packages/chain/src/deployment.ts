import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseBasket, serializeBasket, type Basket, type BasketFile } from '@mch/index-core';
import type { OracleSettings, OutRef, TokenMetadata } from './codec.ts';
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
  /** 'submitted' until the network has confirmed it. Absent means confirmed. */
  status?: DeployStatus;
}

/**
 * Records are written the moment a transaction is signed, before it is sent,
 * so nothing that reaches the chain can ever go unrecorded.
 */
export type DeployStatus = 'submitted' | 'confirmed';

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
  /** The name, ticker, description and logo it was created with (records from before this have none). */
  metadata?: TokenMetadata;
  mintTx: string;
  /** 'submitted' until the network has confirmed it. Absent means confirmed. */
  status?: DeployStatus;
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

/** What to do with each part: create it, check on an earlier unconfirmed attempt, or leave it. */
export type PartAction = 'create' | 'resume' | 'none';

export type DeployPlan =
  { ok: true; token: PartAction; oracle: PartAction } | { ok: false; reason: string };

function actionFor(part: { status?: DeployStatus } | undefined): PartAction {
  if (!part) return 'create';
  return part.status === 'submitted' ? 'resume' : 'none';
}

/**
 * Decides what a deploy run may do, given the record of what already exists.
 * Its main job is to make a second coin impossible by accident: a recorded,
 * confirmed coin is never minted again, and an unconfirmed one is only ever
 * checked on (and, if it provably never landed, resent with the same seed,
 * which can only produce that same coin).
 */
export function planDeployment(existing: Deployment | null, o: { tokenOnly: boolean }): DeployPlan {
  const token = actionFor(existing?.token);
  if (o.tokenOnly) {
    if (token === 'none') {
      return {
        ok: false,
        reason: `The MCH coin already exists (policy ${existing!.token!.policyId}). Creating it again would make a second, different coin.`,
      };
    }
    return { ok: true, token, oracle: 'none' };
  }
  let oracle = actionFor(existing?.oracle);
  // Confirmed, but its reference script could not be read at the time: look again.
  if (oracle === 'none' && !existing?.oracle?.referenceScript) oracle = 'resume';
  if (token === 'none' && oracle === 'none') {
    return {
      ok: false,
      reason: 'Both the coin and the oracle already exist. There is nothing to deploy.',
    };
  }
  return { ok: true, token, oracle };
}

export function loadDeployment(path: string): Deployment {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, ''); // a BOM some editors add
  try {
    return JSON.parse(text) as Deployment;
  } catch {
    throw new Error(
      `${path} could not be read (it may have been changed in an editor, or only partly written).`,
    );
  }
}

/** Writes a full copy first and swaps it in, so a crash mid-write cannot damage the record. */
export function saveDeployment(path: string, deployment: Deployment): void {
  mkdirSync(dirname(path), { recursive: true });
  const text = `${JSON.stringify(deployment, null, 2)}\n`;
  const copy = `${path}.tmp`;
  writeFileSync(copy, text);
  try {
    renameSync(copy, path);
  } catch {
    // Windows can refuse to replace a file another program has open.
    writeFileSync(path, text);
    rmSync(copy, { force: true });
  }
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
