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
const playerCount = Number(process.env.OMEGA_PLAYERS ?? 2);
const objective = (process.env.OMEGA_OBJECTIVE ?? 'points') as GameObjective;
const temperature = Number(process.env.OMEGA_TEMPERATURE ?? 1);
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
  `Collecting Class Ω self-play: ${games} games, ${playerCount}p, ${objective}, temperature=${temperature}`
);

const result = await collectOmegaParallel({
  options: {
    games,
    net,
    seed,
    objective,
    playerCount,
    temperature,
    progressEvery,
  },
  outPath,
});

console.log(
  `Wrote ${result.rows} rows from ${result.completedGames}/${result.games} games to ${outPath}`
);
