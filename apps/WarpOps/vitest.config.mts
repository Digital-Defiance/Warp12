import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  root: import.meta.dirname,
  envDir: resolve(import.meta.dirname, '../Warp12'),
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
