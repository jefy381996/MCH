import {
  Blockfrost,
  Koios,
  Lucid,
  type LucidEvolution,
  type Provider,
} from '@lucid-evolution/lucid';

export type NetworkName = 'Preprod' | 'Preview' | 'Mainnet';
export type ProviderName = 'koios' | 'blockfrost';

export interface ConnectOptions {
  network: NetworkName;
  provider: ProviderName;
  /** Required for Blockfrost; free at blockfrost.io. Koios needs no key. */
  blockfrostProjectId?: string;
}

const KOIOS: Record<NetworkName, string> = {
  Mainnet: 'https://api.koios.rest/api/v1',
  Preprod: 'https://preprod.koios.rest/api/v1',
  Preview: 'https://preview.koios.rest/api/v1',
};

const BLOCKFROST: Record<NetworkName, string> = {
  Mainnet: 'https://cardano-mainnet.blockfrost.io/api/v0',
  Preprod: 'https://cardano-preprod.blockfrost.io/api/v0',
  Preview: 'https://cardano-preview.blockfrost.io/api/v0',
};

export function isNetworkName(value: string): value is NetworkName {
  return value === 'Preprod' || value === 'Preview' || value === 'Mainnet';
}

export function createProvider(o: ConnectOptions): Provider {
  if (o.provider === 'blockfrost') {
    if (!o.blockfrostProjectId)
      throw new Error('BLOCKFROST_PROJECT_ID is required for the Blockfrost provider');
    return new Blockfrost(BLOCKFROST[o.network], o.blockfrostProjectId);
  }
  return new Koios(KOIOS[o.network]);
}

export async function connect(o: ConnectOptions): Promise<LucidEvolution> {
  return Lucid(createProvider(o), o.network);
}

export function explorerTxUrl(network: NetworkName | 'Custom', txHash: string): string {
  const host =
    network === 'Mainnet'
      ? 'cardanoscan.io'
      : network === 'Preview'
        ? 'preview.cardanoscan.io'
        : 'preprod.cardanoscan.io';
  return `https://${host}/transaction/${txHash}`;
}

export function explorerTokenUrl(network: NetworkName | 'Custom', unit: string): string {
  const host =
    network === 'Mainnet'
      ? 'cardanoscan.io'
      : network === 'Preview'
        ? 'preview.cardanoscan.io'
        : 'preprod.cardanoscan.io';
  return `https://${host}/token/${unit}`;
}
