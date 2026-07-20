/**
 * Mirror Windows MSIX tile art from src-tauri/icons → gen/windows/Assets.
 *
 * `icons/` is canonical (Illustrator exports, tauri icon CLI output, etc.).
 * MSIX packaging reads gen/windows/Assets — tauri-windows-bundle only auto-copies
 * three square logos and regenerates Wide310x150 (often blank). Sync everything
 * here before `tauri:windows:build`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(appRoot, 'src-tauri/icons');
const assetsDir = join(appRoot, 'src-tauri/gen/windows/Assets');

/** Required by gen/windows/AppxManifest.xml.template */
const REQUIRED_MSIX_TILES = [
  'StoreLogo.png',
  'Square44x44Logo.png',
  'Square150x150Logo.png',
  'Wide310x150Logo.png',
];

/** Optional tiles (not in manifest today; harmless to ship; useful if manifest expands). */
const OPTIONAL_MSIX_TILES = [
  'SplashScreen.png',
  'Square71x71Logo.png',
  'Square310x310Logo.png',
];

function windowsTileSources() {
  const fromRoot = readdirSync(iconsDir).filter(
    (name) =>
      name.endsWith('.png') &&
      (name.includes('Logo') || name === 'SplashScreen.png')
  );
  const ordered = [...REQUIRED_MSIX_TILES, ...OPTIONAL_MSIX_TILES];
  const extras = fromRoot.filter((name) => !ordered.includes(name)).sort();
  return [...ordered.filter((name) => fromRoot.includes(name)), ...extras];
}

mkdirSync(assetsDir, { recursive: true });

const sources = windowsTileSources();
if (sources.length === 0) {
  console.error(`No Windows tile PNGs found in ${iconsDir}`);
  process.exit(1);
}

for (const name of REQUIRED_MSIX_TILES) {
  if (!existsSync(join(iconsDir, name))) {
    console.error(`Missing required MSIX tile: ${join(iconsDir, name)}`);
    process.exit(1);
  }
}

for (const name of sources) {
  copyFileSync(join(iconsDir, name), join(assetsDir, name));
}

console.log(
  `Synced ${sources.length} Windows tile PNGs → gen/windows/Assets/ (${REQUIRED_MSIX_TILES.length} required for manifest)`
);
