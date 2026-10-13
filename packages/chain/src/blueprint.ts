import {
  applyDoubleCborEncoding,
  applyParamsToScript,
  validatorToAddress,
  validatorToScriptHash,
  type Network,
  type Script,
} from '@lucid-evolution/lucid';
import blueprint from '../../../contracts/plutus.json' with { type: 'json' };
import {
  oracleSettingsData,
  tokenSettingsData,
  type OracleSettings,
  type TokenSettings,
} from './codec.ts';

export interface CompiledScript {
  script: Script;
  /** Script hash: the policy id for minting, the credential for the address. */
  hash: string;
  address: string;
}

function compiledCode(title: string): string {
  const validator = blueprint.validators.find((v) => v.title === title);
  if (!validator) {
    throw new Error(
      `${title} is missing from contracts/plutus.json (run: npm run contracts:build)`,
    );
  }
  return validator.compiledCode;
}

function compile(code: string, network: Network): CompiledScript {
  const script: Script = { type: 'PlutusV3', script: code };
  return {
    script,
    hash: validatorToScriptHash(script),
    address: validatorToAddress(network, script),
  };
}

/** The oracle validator with its settings applied. Same script for spend and mint. */
export function oracleScript(settings: OracleSettings, network: Network): CompiledScript {
  const code = applyParamsToScript(applyDoubleCborEncoding(compiledCode('oracle.oracle.spend')), [
    oracleSettingsData(settings),
  ]);
  return compile(code, network);
}

export function tokenScript(settings: TokenSettings, network: Network): CompiledScript {
  const code = applyParamsToScript(
    applyDoubleCborEncoding(compiledCode('mch_token.mch_token.mint')),
    [tokenSettingsData(settings)],
  );
  return compile(code, network);
}

/** Always-fail address where reference scripts are published for good. */
export function scriptStore(network: Network): CompiledScript {
  return compile(applyDoubleCborEncoding(compiledCode('script_store.script_store.else')), network);
}

/** Hash of the un-parameterised oracle code, recorded so deployments can be audited. */
export function blueprintHashes(): Record<string, string> {
  return Object.fromEntries(blueprint.validators.map((v) => [v.title, v.hash]));
}
