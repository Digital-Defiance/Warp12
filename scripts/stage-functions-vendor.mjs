import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [srcDir, destDir] = process.argv.slice(2);
if (!srcDir || !destDir) {
  console.error('Usage: stage-functions-vendor.mjs <srcDir> <destDir>');
  process.exit(1);
}

rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

cpSync(join(srcDir, 'dist'), join(destDir, 'dist'), { recursive: true });

const pkg = JSON.parse(readFileSync(join(srcDir, 'package.json'), 'utf8'));
delete pkg.devDependencies;
delete pkg.publishConfig;
delete pkg.repository;
if (pkg.scripts?.prepublishOnly) {
  delete pkg.scripts.prepublishOnly;
}

writeFileSync(join(destDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
