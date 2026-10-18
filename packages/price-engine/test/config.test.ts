import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, REPO_ROOT } from '../src/config.ts';

describe('loadConfig paths', () => {
  it('reads relative paths from the repository root, not from wherever npm runs', () => {
    const config = loadConfig({
      ORACLE_DEPLOYMENT_FILE: 'deployments/mainnet.json',
      BASKET_FILE: 'config/basket.json',
    });
    expect(config.ORACLE_DEPLOYMENT_FILE).toBe(join(REPO_ROOT, 'deployments', 'mainnet.json'));
    expect(config.BASKET_FILE).toBe(join(REPO_ROOT, 'config', 'basket.json'));
  });

  it('keeps absolute paths as they are', () => {
    expect(
      loadConfig({ ORACLE_DEPLOYMENT_FILE: '/srv/mch/mainnet.json' }).ORACLE_DEPLOYMENT_FILE,
    ).toBe('/srv/mch/mainnet.json');
  });

  it('defaults point inside the repository', () => {
    const config = loadConfig({});
    expect(config.BASKET_FILE).toBe(join(REPO_ROOT, 'config', 'basket.json'));
    expect(config.ORACLE_DEPLOYMENT_FILE).toBeUndefined();
  });
});
