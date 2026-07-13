#!/usr/bin/env node
/**
 * Merge partial results from parallel workers into comprehensive dataset.
 * Supports both coarse-grained (by factor) and fine-grained (by config) outputs.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = 'tools/nn/data';
const OUTPUT = 'tools/nn/data/luck-skill-comprehensive.json';

console.error('Merging results from workers...');

const allResults = [];
let totalGames = 0;

// Auto-detect result files (both formats)
const files = readdirSync(DATA_DIR).filter(
  (f) => f.startsWith('luck-skill-w') && f.endsWith('.json') && f !== 'luck-skill-comprehensive.json'
);

for (const file of files) {
  const path = resolve(DATA_DIR, file);
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    
    // Coarse-grained format: { results: [...] }
    if (Array.isArray(data.results)) {
      allResults.push(...data.results);
      totalGames += data.results.length * (data.gamesPerConfig ?? 0);
      console.error(`  ✓ ${file}: ${data.results.length} configs`);
    }
    // Fine-grained format: single config object
    else if (data.maxPip && data.playerCount) {
      allResults.push(data);
      totalGames += data.games ?? 0;
      console.error(`  ✓ ${file}: W${data.maxPip} @ ${data.playerCount}p`);
    }
  } catch (err) {
    console.error(`  ✗ ${file}: invalid - ${err}`);
  }
}

const merged = {
  metadata: {
    collectedAt: new Date().toISOString(),
    warpFactors: [...new Set(allResults.map((r) => r.maxPip))].sort((a, b) => a - b),
    totalConfigs: allResults.length,
    totalGames,
  },
  results: allResults.sort((a, b) => {
    if (a.maxPip !== b.maxPip) return a.maxPip - b.maxPip;
    return a.playerCount - b.playerCount;
  }),
};

writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));

console.error(`\n✓ Merged ${allResults.length} configs (${totalGames} games) into ${OUTPUT}`);
