import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const tauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  root: import.meta.dirname,
  base: tauriBuild ? './' : '/',
  envDir: resolve(import.meta.dirname, '../Warp12'),
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  cacheDir: '../../node_modules/.vite/apps/WarpOps',
  plugins: [react()],
  server: {
    port: 4220,
    host: 'localhost',
    strictPort: true,
  },
  preview: {
    port: 4320,
    host: 'localhost',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
