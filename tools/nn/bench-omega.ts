import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  benchOmegaVsCommander,
  validateOmegaModelWeights,
  type OmegaModelWeights,
} from '../../libs/engine/src/lib/ai/index.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.OMEGA_BENCH_GAMES ?? 200);
const seed = Number(process.env.OMEGA_BENCH_SEED ?? 42);
const objective = (process.env.OMEGA_OBJECTIVE ?? 'points') as GameObjective;
const weightsPath =
  process.env.OMEGA_WEIGHTS ??
  resolve(repoRoot, 'apps/Warp12/public/models/omega-v1.json');

/** Player counts to sweep — the promotion gate must hold across all of these. */
const playerCounts = (process.env.OMEGA_BENCH_PLAYERS ?? '2,3,4')
  .split(',')
  .map((part) => Number(part.trim()))
  .filter((value) => Number.isFinite(value) && value >= 2);

const raw = readFileSync(weightsPath, 'utf8');
const net = JSON.parse(raw) as OmegaModelWeights;
validateOmegaModelWeights(net);

const results = [];
for (const playerCount of playerCounts) {
  // Both seats to cancel first-mover bias at 2p; seat 'a' only for 3+ (symmetry
  // across many opponents is diluted anyway).
  const seatIds = playerCount === 2 ? (['a', 'b'] as const) : (['a'] as const);
  for (const omegaSeatId of seatIds) {
    results.push(
      benchOmegaVsCommander({
        games,
        net,
        seed,
        objective,
        playerCount,
        omegaSeatId,
      })
    );
  }
}

console.log(
  JSON.stringify(
    { weights: weightsPath, objective, gamesPerSlice: games, results },
    null,
    2
  )
);
