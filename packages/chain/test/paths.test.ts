import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  defaultDeploymentFile,
  deploymentFileFromEnv,
  REPO_ROOT,
  repoPath,
} from '../scripts/env.ts';

const expectedRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('deployment record paths', () => {
  it('are real file paths at the repository root (not URL paths, which break on Windows and with spaces)', () => {
    expect(REPO_ROOT).toBe(expectedRoot);
    expect(defaultDeploymentFile('Mainnet')).toBe(
      join(expectedRoot, 'deployments', 'mainnet.json'),
    );
    expect(defaultDeploymentFile('Mainnet')).not.toMatch(/%[0-9A-F]{2}/i);
  });

  it('read a relative DEPLOYMENT_FILE from the repository root', () => {
    expect(deploymentFileFromEnv('Preprod', { DEPLOYMENT_FILE: 'deployments/x.json' })).toBe(
      join(expectedRoot, 'deployments', 'x.json'),
    );
    expect(deploymentFileFromEnv('Preprod', {})).toBe(
      join(expectedRoot, 'deployments', 'preprod.json'),
    );
    expect(repoPath('/abs/file.json')).toBe('/abs/file.json');
  });

  it('decode a URL-style path the way Windows needs it', () => {
    // The old code used URL.pathname, which gives "/C:/Users/Jo%20Smith/..." on Windows.
    const url = new URL('file:///C:/Users/Jo%20Smith/MCH/deployments/mainnet.json');
    expect(fileURLToPath(url, { windows: true })).toBe(
      'C:\\Users\\Jo Smith\\MCH\\deployments\\mainnet.json',
    );
    expect(url.pathname).toBe('/C:/Users/Jo%20Smith/MCH/deployments/mainnet.json');
  });
});
