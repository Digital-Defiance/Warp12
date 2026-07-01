/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

const tauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig(() => ({
  root: import.meta.dirname,
  base: tauriBuild ? './' : '/',
  cacheDir: '../../node_modules/.vite/apps/Warp12',
  optimizeDeps: {
    exclude: ['warp12-engine'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      doubletwelve: path.resolve(
        import.meta.dirname,
        '../../vendor/DoubleTwelve/dist/index.js'
      ),
      'warp12-engine': path.resolve(
        import.meta.dirname,
        '../../libs/engine/src/index.ts'
      ),
      'warp12-react': path.resolve(
        import.meta.dirname,
        '../../libs/react/src/index.ts'
      ),
      'warp12-theme': path.resolve(
        import.meta.dirname,
        '../../libs/theme/src/index.ts'
      ),
    },
  },
  server:{
    port: 4200,
    host: 'localhost',
  },
  preview:{
    port: 4300,
    host: 'localhost',
  },
  plugins: [react()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@warp12/Warp12',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    }
  },
}));
