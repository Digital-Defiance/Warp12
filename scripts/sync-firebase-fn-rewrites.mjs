#!/usr/bin/env node
/**
 * Add missing callable Hosting rewrites from scripts/firebase-callable-rewrites.json
 * into every firebase.json hosting target (before the SPA catch-all).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'scripts/firebase-callable-rewrites.json'), 'utf8')
);
const firebasePath = join(root, 'firebase.json');
const firebaseJson = JSON.parse(readFileSync(firebasePath, 'utf8'));

let added = 0;
for (const target of firebaseJson.hosting) {
  const rewrites = target.rewrites ?? [];
  const bySource = new Map(rewrites.map((r) => [r.source, r]));
  const spaIdx = rewrites.findIndex(
    (r) => r.source === '**' || r.destination === '/index.html'
  );
  const insertAt = spaIdx >= 0 ? spaIdx : rewrites.length;
  const toInsert = [];
  for (const { name, serviceId } of manifest) {
    const source = `/api/fn/${name}`;
    if (bySource.has(source)) continue;
    toInsert.push({
      source,
      run: { serviceId, region: 'us-central1' },
    });
    added += 1;
  }
  if (toInsert.length) {
    target.rewrites = [
      ...rewrites.slice(0, insertAt),
      ...toInsert,
      ...rewrites.slice(insertAt),
    ];
  }
}

writeFileSync(firebasePath, JSON.stringify(firebaseJson, null, 2) + '\n');
console.log(`Synced callable rewrites (+${added} across hosting targets).`);
