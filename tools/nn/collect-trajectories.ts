import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectClass1StarTrajectoriesToSink,
  serializeClass1StarTrajectoryRow,
} from '../../libs/engine/src/lib/ai/collect-class1-star-trajectories.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const here = dirname(fileURLToPath(import.meta.url));

const games = Number(process.env.CLASS1_STAR_GAMES ?? 200);
const seed = Number(process.env.CLASS1_STAR_SEED ?? 2026);
const playerCount = Number(process.env.CLASS1_STAR_PLAYERS ?? 2);
const objective = (process.env.CLASS1_STAR_OBJECTIVE ?? 'points') as GameObjective;
const outPath =
  process.env.CLASS1_STAR_OUT ??
  resolve(here, 'data/trajectories.jsonl');
const progressEvery = Number(process.env.CLASS1_STAR_PROGRESS_EVERY ?? 50);

console.log(
  `Collecting Class I* trajectories: ${games} games, ${playerCount}p, ${objective}`
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, '', 'utf8');

const result = collectClass1StarTrajectoriesToSink(
  {
    games,
    seed,
    objective,
    playerCount,
    includeContrast: process.env.CLASS1_STAR_CONTRAST === '1',
    exportAllCandidates: process.env.CLASS1_STAR_ALL_CANDIDATES !== '0',
    progressEvery,
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
  `Wrote ${result.rows} rows from ${result.completedGames}/${result.games} games to ${outPath}`
);
