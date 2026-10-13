import type { Config } from '../config.ts';
import { MemoryPriceStore } from './memory-store.ts';
import { PostgresPriceStore } from './postgres-store.ts';
import type { PriceStore } from './price-store.ts';

export type { PriceStore, HistoryPoint } from './price-store.ts';
export { MemoryPriceStore } from './memory-store.ts';
export { PostgresPriceStore } from './postgres-store.ts';

export function createPriceStore(config: Config): PriceStore {
  return config.DATABASE_URL ? new PostgresPriceStore(config.DATABASE_URL) : new MemoryPriceStore();
}
