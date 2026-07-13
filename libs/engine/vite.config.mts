import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/engine',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: {
        index: 'src/index.ts',
        node: 'src/node.ts',
      },
      name: 'warp12-engine',
      formats: ['es' as const],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      external: ['double-eighteen'],
    },
  },
  test: {
    name: 'warp12-engine',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    // Parallel execution optimized for M4 Max (12-16 cores)
    pool: 'threads',
    minThreads: 8,
    maxThreads: 14,  // Leave 2 cores for system
    // Allow tests within same file to run in parallel
    sequence: {
      concurrent: true,
    },
  },
}));
