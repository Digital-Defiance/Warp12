import { appendFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectAdvisorTrajectoriesToSink,
  createZeroOmegaModelWeights,
  validateOmegaModelWeights,
  type OmegaModelWeights,
} from '../../libs/engine/src/lib/ai/index.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.ADVISOR_GAMES ?? 120);
const seed = Number(process.env.ADVISOR_SEED ?? 2026);
const objective = (process.env.ADVISOR_OBJECTIVE ?? 'points') as GameObjective;
const playerCount = Number(process.env.ADVISOR_PLAYERS ?? 4);
const searchIterations = Number(process.env.ADVISOR_SEARCH_ITERS ?? 320);
const searchLeaf = (process.env.ADVISOR_SEARCH_LEAF ?? 'puct') as
  | 'puct'
  | 'heuristic'
  | 'value';
const outPath =
  process.env.ADVISOR_OUT ?? resolve(here, 'data/advisor-trajectories.jsonl');
const progressEvery = Number(process.env.ADVISOR_PROGRESS_EVERY ?? 20);
const weightsPath =
  process.env.ADVISOR_OMEGA_WEIGHTS ??
  resolve(
    repoRoot,
    objective === 'go-out'
      ? 'apps/Warp12/public/models/omega-goout-v1.json'
      : 'apps/Warp12/public/models/omega-v1.json'
  );

function loadNet(): OmegaModelWeights {
  const raw = readFileSync(weightsPath, 'utf8');
  const parsed = JSON.parse(raw) as OmegaModelWeights;
  validateOmegaModelWeights(parsed);
  console.log(`Loaded Ω teacher from ${weightsPath}`);
  return parsed;
}

const net = loadNet();
const sink = {
  write(rows: readonly { readonly [key: string]: unknown }[]) {
    for (const row of rows) {
      appendFileSync(outPath, `${JSON.stringify(row)}\n`);
    }
  },
};

console.log(
  `Collecting advisor trajectories: ${games} games, ${playerCount}p, ${objective}, teacher=${searchLeaf}@${searchIterations}`
);

const result = collectAdvisorTrajectoriesToSink(
  {
    games,
    net,
    seed,
    objective,
    playerCount,
    searchIterations,
    searchLeaf,
    progressEvery,
  },
  sink
);

console.log(
  `Wrote ${result.rows} rows from ${result.completedGames}/${result.games} games to ${outPath}`
);
