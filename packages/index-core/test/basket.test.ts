import { describe, expect, it } from 'vitest';
import { parseBasket, serializeBasket, validateBasket, type Basket } from '../src/basket.ts';

const valid = {
  name: 'Test basket',
  version: 1,
  baseDate: '2026-10-13',
  isDemo: true,
  components: [
    { metal: 'XAU', weightPpm: 250_000, basePrice: '4000.000000' },
    { metal: 'XAG', weightPpm: 250_000, basePrice: '48.000000' },
    { metal: 'XPT', weightPpm: 250_000, basePrice: '1600.000000' },
    { metal: 'NI', weightPpm: 250_000, basePrice: '15500.000000' },
  ],
};

describe('parseBasket', () => {
  it('parses a valid file and round-trips through serializeBasket', () => {
    const basket = parseBasket(valid);
    expect(basket.components[0]?.basePriceMicro).toBe(4_000_000_000n);
    expect(serializeBasket(basket)).toEqual(valid);
  });

  it('rejects weights that do not sum to 100%', () => {
    const bad = structuredClone(valid);
    bad.components[0]!.weightPpm = 250_001;
    expect(() => parseBasket(bad)).toThrow(/weights sum to 1000001/);
  });

  it('rejects unknown metals', () => {
    const bad = structuredClone(valid);
    bad.components[0]!.metal = 'MG';
    expect(() => parseBasket(bad)).toThrow(/not a known metal/);
  });

  it('rejects float base prices, which would lose precision', () => {
    const bad = structuredClone(valid) as unknown as { components: Array<{ basePrice: unknown }> };
    bad.components[0]!.basePrice = 4000;
    expect(() => parseBasket(bad)).toThrow(/decimal string/);
  });
});

describe('validateBasket', () => {
  const base = (): Basket => parseBasket(valid);

  it('accepts the valid basket', () => {
    expect(validateBasket(base())).toEqual([]);
  });

  it('reports every problem at once', () => {
    const b = base();
    b.version = 0;
    b.baseDate = '13/10/2026';
    b.components[1]!.metal = 'XAU';
    b.components[2]!.basePriceMicro = 0n;
    const errors = validateBasket(b);
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/version/);
    expect(errors.join('\n')).toMatch(/baseDate/);
    expect(errors.join('\n')).toMatch(/XAU appears more than once/);
    expect(errors.join('\n')).toMatch(/basePrice must be positive/);
  });

  it('rejects an empty basket', () => {
    const b = base();
    b.components = [];
    expect(validateBasket(b).join()).toMatch(/1\.\.8 components/);
  });
});
