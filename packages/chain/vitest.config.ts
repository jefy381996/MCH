import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'chain', testTimeout: 60_000, hookTimeout: 60_000 },
});
