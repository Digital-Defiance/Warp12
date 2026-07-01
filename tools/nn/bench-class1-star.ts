import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  benchClass1StarVsCommander,
  measureClass1StarCommanderAgreement,
} from '../../libs/engine/src/lib/ai/bench-class1-star.ts';
import {
  createTsResidualScorer,
  type Class1StarModelWeights,
} from '../../libs/engine/src/lib/ai/residual-scorer.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.CLASS1_STAR_BENCH_GAMES ?? 100);
const seed = Number(process.env.CLASS1_STAR_BENCH_SEED ?? 42);
const playerCount = Number(process.env.CLASS1_STAR_PLAYERS ?? 2);
const objective = (process.env.CLASS1_STAR_OBJECTIVE ?? 'points') as GameObjective;
const weightsPath =
  process.env.CLASS1_STAR_WEIGHTS ??
  resolve(repoRoot, 'apps/Warp12/public/models/class1-star-v1.json');

const raw = readFileSync(weightsPath, 'utf8');
const weights = JSON.parse(raw) as Class1StarModelWeights;
const scorer = createTsResidualScorer(weights);

const agreement = measureClass1StarCommanderAgreement({
  games: Math.min(games, 80),
  seed,
  objective,
  playerCount,
  residualScorer: scorer,
});

const result = benchClass1StarVsCommander({
  games,
  seed,
  objective,
  playerCount,
  residualScorer: scorer,
});

console.log(
  JSON.stringify(
    {
      ...result,
      agreement,
      weights: weightsPath,
      objective,
      playerCount,
      modelAlpha: weights.alpha,
    },
    null,
    2
  )
);
