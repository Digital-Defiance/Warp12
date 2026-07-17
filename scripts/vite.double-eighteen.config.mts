import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Monorepo-only build for `vendor/double-eighteen` (Warp12 parent Vite 8).
 *
 * Do NOT change the submodule's own `vite.lib.config.ts` or `yarn build:lib`
 * for this — standalone double-eighteen (outside this repo) keeps using those.
 * Parent used to shell into the submodule's nested Vite 7; that path breaks when
 * the workspace hoists estree-walker@3 (ESM-only) into a CJS config load.
 */
const pkgRoot = resolve(import.meta.dirname, '../vendor/double-eighteen');

export default defineConfig({
  root: pkgRoot,
  publicDir: false,
  plugins: [
    dts({
      entryRoot: resolve(pkgRoot, 'src'),
      tsconfigPath: resolve(pkgRoot, 'tsconfig.app.json'),
      include: ['src/index.ts', 'src/**/*.ts'],
      exclude: ['**/*.spec.ts'],
      rollupTypes: false,
      insertTypesEntry: true,
      outDir: resolve(pkgRoot, 'dist'),
    }),
  ],
  build: {
    copyPublicDir: false,
    lib: {
      entry: resolve(pkgRoot, 'src/index.ts'),
      name: 'double-eighteen',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    outDir: resolve(pkgRoot, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
