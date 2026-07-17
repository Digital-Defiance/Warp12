#!/usr/bin/env node
/**
 * Ensures every exported callable in functions/src/index.ts has a Firebase
 * Hosting /api/fn rewrite (same-origin proxy for browser clients).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexTs = readFileSync(join(root, 'functions/src/index.ts'), 'utf8');
const firebaseJson = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));
const expected = JSON.parse(
  readFileSync(join(root, 'scripts/firebase-callable-rewrites.json'), 'utf8')
);

const exportBlock = indexTs.match(/export\s*\{([^}]+)\}/s);
if (!exportBlock) {
  console.error('Could not parse exports from functions/src/index.ts');
  process.exit(1);
}

const exported = new Set(
  exportBlock[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

// Background Firestore triggers are exported for Firebase deployment but are
// not HTTP callables and must not receive Hosting rewrites.
const nonCallableExports = new Set([
  'onDisplayNameContentReview',
  'onMessageContentReview',
  'onMessageShadowMute',
  'onRatingEventAbuseReview',
]);
for (const name of nonCallableExports) {
  exported.delete(name);
}

const expectedNames = new Set(expected.map((e) => e.name));
const missingFromManifest = [...exported].filter((n) => !expectedNames.has(n));
const extraInManifest = [...expectedNames].filter((n) => !exported.has(n));
if (missingFromManifest.length || extraInManifest.length) {
  if (missingFromManifest.length) {
    console.error('Add to scripts/firebase-callable-rewrites.json:', missingFromManifest.join(', '));
  }
  if (extraInManifest.length) {
    console.error('Remove stale rewrites manifest entries:', extraInManifest.join(', '));
  }
  process.exit(1);
}

for (const target of firebaseJson.hosting) {
  const rewrites = target.rewrites ?? [];
  const fnRewrites = rewrites.filter((r) => r.source?.startsWith('/api/fn/'));
  const bySource = new Map(fnRewrites.map((r) => [r.source, r]));

  for (const { name, serviceId } of expected) {
    const source = `/api/fn/${name}`;
    const rewrite = bySource.get(source);
    if (!rewrite) {
      console.error(`Missing rewrite ${source} in hosting target "${target.target}"`);
      process.exit(1);
    }
    if (rewrite.run?.serviceId !== serviceId) {
      console.error(
        `Wrong serviceId for ${source} in "${target.target}": expected ${serviceId}, got ${rewrite.run?.serviceId}`
      );
      process.exit(1);
    }
  }
}

console.log(`OK: ${expected.length} callable rewrites in ${firebaseJson.hosting.length} hosting target(s).`);
