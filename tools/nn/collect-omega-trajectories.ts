import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectOmegaParallel,
} from '../../libs/engine/src/lib/ai/collect-omega-parallel.ts';
import {
  createZeroOmegaModelWeights,
  validateOmegaModelWeights,
  type OmegaModelWeights,
} from '../../libs/engine/src/lib/ai/index.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.OMEGA_GAMES ?? 200);
const seed = Number(process.env.OMEGA_SEED ?? 2026);

/** Parse OMEGA_PLAYERS as a single count, comma list ("3,4,6,8"), or range ("3-8"). */
function parsePlayerCounts(raw: string): number[] {
  const trimmed = raw.trim();
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const lo = Number(rangeMatch[1]);
    const hi = Number(rangeMatch[2]);
    const out: number[] = [];
    for (let n = lo; n <= hi; n++) out.push(n);
    return out;
  }
  return trimmed
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n >= 2);
}

const playerCountsRaw = process.env.OMEGA_PLAYERS ?? '2';
const playerCounts = parsePlayerCounts(playerCountsRaw);
const playerCount = playerCounts[0] ?? 2;
const mixedTable = playerCounts.length > 1;
const objective = (process.env.OMEGA_OBJECTIVE ?? 'points') as GameObjective;
const temperature = Number(process.env.OMEGA_TEMPERATURE ?? 1);
const searchIterations = Number(process.env.OMEGA_SEARCH_ITERS ?? 0);
const searchMaxBranch = Number(process.env.OMEGA_SEARCH_MAX_BRANCH ?? 8);
const searchLeaf = (process.env.OMEGA_SEARCH_LEAF ?? 'heuristic') as
  | 'puct'
  | 'heuristic'
  | 'value';
const outPath = process.env.OMEGA_OUT ?? resolve(here, 'data/omega-trajectories.jsonl');
const progressEvery = Number(process.env.OMEGA_PROGRESS_EVERY ?? 25);
const weightsPath =
  process.env.OMEGA_WEIGHTS ??
  resolve(repoRoot, 'apps/Warp12/public/models/omega-v1.json');
const policyHidden = (process.env.OMEGA_POLICY_HIDDEN ?? '256,256')
  .split(',')
  .map((part) => Number(part.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const valueHidden = (process.env.OMEGA_VALUE_HIDDEN ?? '256,128')
  .split(',')
  .map((part) => Number(part.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

function loadNet(): OmegaModelWeights {
  try {
    const raw = readFileSync(weightsPath, 'utf8');
    const parsed = JSON.parse(raw) as OmegaModelWeights;
    validateOmegaModelWeights(parsed);
    console.log(`Loaded Omega weights from ${weightsPath}`);
    return parsed;
  } catch {
    console.log(
      `No usable weights at ${weightsPath}; self-play from a zero-init (uniform-random) network.`
    );
    return createZeroOmegaModelWeights(policyHidden, valueHidden);
  }
}

const net = loadNet();

console.log(
  `Collecting Class Ω self-play: ${games} games, ${
    mixedTable ? `mixed tables [${playerCounts.join(',')}]` : `${playerCount}p`
  }, ${objective}, temperature=${temperature}${
    searchIterations > 0 ? `, ISMCTS ${searchIterations} iters/decision` : ''
  }`
);

const result = await collectOmegaParallel({
  options: {
    games,
    net,
    seed,
    objective,
    playerCount,
    ...(mixedTable ? { playerCounts } : {}),
    temperature,
    ...(searchIterations > 0 ? { searchIterations, searchMaxBranch, searchLeaf } : {}),
    progressEvery,
  },
  outPath,
});

console.log(
  `Wrote ${result.rows} rows from ${result.completedGames}/${result.games} games to ${outPath}`
);
