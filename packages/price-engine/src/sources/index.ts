import type { Basket } from '@mch/index-core';
import type { Config } from '../config.ts';
import { DemoSource } from './demo-source.ts';
import type { PriceSource } from './price-source.ts';

export type { PriceSource } from './price-source.ts';
export { PriceSourceError } from './price-source.ts';
export { DemoSource } from './demo-source.ts';

/** The one place that maps PRICE_SOURCE to an implementation. */
export function createPriceSource(config: Config, basket: Basket): PriceSource {
  switch (config.PRICE_SOURCE) {
    case 'demo':
      return new DemoSource({ basket, seed: config.DEMO_SEED, speed: config.DEMO_SPEED });
  }
}
