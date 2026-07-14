import { defineConfig } from 'vitest/config';
import * as path from 'path';

/**
 * Minimal vitest config for pure (no Firebase) logic in functions/src.
 * Only files with zero `firebase-admin` / `firebase-functions` imports at
 * module scope are testable this way — those SDKs call side-effecting init
 * code (`admin.firestore()`, etc.) at import time.
 */
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: 'functions',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    conditions: ['@warp12/source'],
  },
});
