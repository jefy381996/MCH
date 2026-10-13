import type { OracleStatus } from '@mch/chain';

export type { OracleStatus } from '@mch/chain';

/**
 * What the website shows about the on-chain feed. Implemented in @mch/chain
 * and loaded only when a deployment is configured, so the backend runs fine
 * (and starts fast) with no chain at all.
 */
export interface OracleReader {
  read(): Promise<OracleStatus | null>;
}
