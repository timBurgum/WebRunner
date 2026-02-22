import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 60_000,  // 60s per test — browser tests can be slow
    hookTimeout: 30_000,
    pool: 'forks',        // Use forks so each file gets its own browser
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    reporters: ['verbose'],
  },
});
