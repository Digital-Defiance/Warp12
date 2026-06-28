/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/react',
  resolve: {
    alias: {
      'warp12-engine': path.resolve(import.meta.dirname, '../engine/src/index.ts'),
      doubletwelve: path.resolve(
        import.meta.dirname,
        '../../vendor/DoubleTwelve/dist/index.js'
      ),
    },
  },
  plugins: [
    react(),
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
      entry: 'src/index.ts',
      name: 'warp12-react',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: ['react', 'react/jsx-runtime', 'doubletwelve', 'warp12-engine'],
    },
  },
  test: {
    name: 'warp12-react',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
