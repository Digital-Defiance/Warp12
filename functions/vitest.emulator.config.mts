import { defineConfig } from 'vitest/config';

/**
 * Callable integration tests against Auth + Firestore + Functions emulators.
 * Run via: yarn test:functions:emulator (scripts/test-functions-emulator.sh).
 */
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: 'functions-emulator',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['test/**/*.emulator.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    conditions: ['@warp12/source'],
  },
});
