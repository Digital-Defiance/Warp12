import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectClass1StarTrajectoriesToSink,
  serializeClass1StarTrajectoryRow,
} from '../../libs/engine/src/lib/ai/collect-class1-star-trajectories.ts';
import {
  createTsResidualScorer,
  createZeroClass1StarModelWeights,
  type Class1StarModelWeights,
} from '../../libs/engine/src/lib/ai/residual-scorer.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.CLASS1_STAR_GAMES ?? 200);
const seed = Number(process.env.CLASS1_STAR_SEED ?? 2026);
const playerCount = Number(process.env.CLASS1_STAR_PLAYERS ?? 2);
const objective = (process.env.CLASS1_STAR_OBJECTIVE ?? 'points') as GameObjective;
const outPath =
  process.env.CLASS1_STAR_OUT ??
  resolve(here, 'data/trajectories-rl.jsonl');
const progressEvery = Number(process.env.CLASS1_STAR_PROGRESS_EVERY ?? 50);
const weightsPath =
  process.env.CLASS1_STAR_WEIGHTS ??
  resolve(repoRoot, 'apps/Warp12/public/models/class1-star-v1.json');
const class1StarSeatId = (process.env.CLASS1_STAR_SEAT ?? 'a') as 'a' | 'b';

function loadScorerWeights(): Class1StarModelWeights {
  try {
    const raw = readFileSync(weightsPath, 'utf8');
    return JSON.parse(raw) as Class1StarModelWeights;
  } catch {
    console.log(
      `No weights at ${weightsPath}; collecting debounced 128×128 model for RL collection.`
    );
    return createZeroClass1StarModelWeights();
  }
}

const weights = loadScorerWeights();
const scorer = createTsResidualScorer(weights);

console.log(
  `Collecting Class I* RL trajectories: ${games} games, ${playerCount}p, ${objective}, seat=${class1StarSeatId}, alpha=${weights.alpha}`
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, '', 'utf8');

const result = collectClass1StarTrajectoriesToSink(
  {
    games,
    seed,
    objective,
    playerCount,
    includeContrast: false,
    exportAllCandidates: true,
    progressEvery,
    collectMode: 'rl',
    residualScorer: scorer,
    class1StarSeatId,
  },
  {
    write(gameRows) {
      if (gameRows.length === 0) {
        return;
      }
      appendFileSync(
        outPath,
        `${gameRows.map((row) => serializeClass1StarTrajectoryRow(row)).join('\n')}\n`,
        'utf8'
      );
    },
  }
);

console.log(
  `Wrote ${result.rows} RL rows from ${result.completedGames}/${result.games} games to ${outPath}`
);
