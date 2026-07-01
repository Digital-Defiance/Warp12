import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { benchFleetAdmiralVsCommanderParallel } from '../../libs/engine/src/lib/ai/bench-fleet-admiral-parallel.ts';
import {
  resolveFleetAdmiralExpectimaxLookahead,
  resolveFleetAdmiralIsmctsLookahead,
  resolveFleetAdmiralPlayLookahead,
} from '../../libs/engine/src/lib/ai/fleet-admiral.ts';
import type { LookaheadOptions } from '../../libs/engine/src/lib/ai/lookahead-options.ts';
import type { Class1StarModelWeights } from '../../libs/engine/src/lib/ai/residual-scorer.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';
import type { PlayerId } from '../../libs/engine/src/lib/types/player.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.FLEET_BENCH_GAMES ?? 100);
const seed = Number(process.env.FLEET_BENCH_SEED ?? 42);
const playerCount = Number(process.env.CLASS1_STAR_PLAYERS ?? 2);
const objective = (process.env.CLASS1_STAR_OBJECTIVE ?? 'points') as GameObjective;
const useClass1Star = process.env.FLEET_BENCH_CLASS1_STAR === '1';
const fleetAdmiralSeatId = (process.env.FLEET_BENCH_SEAT ?? 'a') as PlayerId;
const weightsPath =
  process.env.CLASS1_STAR_WEIGHTS ??
  resolve(repoRoot, 'apps/Warp12/public/models/class1-star-v1.json');

const class1StarWeights = useClass1Star
  ? (JSON.parse(readFileSync(weightsPath, 'utf8')) as Class1StarModelWeights)
  : undefined;

function resolveBenchFleetLookahead(
  benchObjective: GameObjective,
  benchPlayerCount: number
): LookaheadOptions {
  const engine = process.env.FLEET_BENCH_ENGINE ?? 'multi';
  if (engine === 'ismcts') {
    return resolveFleetAdmiralIsmctsLookahead(benchObjective, benchPlayerCount);
  }
  if (engine === 'expectimax') {
    return resolveFleetAdmiralExpectimaxLookahead(
      benchObjective,
      benchPlayerCount
    );
  }
  return resolveFleetAdmiralPlayLookahead(benchObjective, benchPlayerCount, 'bench');
}

const fleetLookahead = resolveBenchFleetLookahead(objective, playerCount);

const result = await benchFleetAdmiralVsCommanderParallel({
  games,
  seed,
  objective,
  playerCount,
  fleetAdmiralSeatId,
  fleetLookahead,
  class1StarWeights,
  parallel: process.env.AI_BENCH_PARALLEL !== '0',
});

console.log(
  JSON.stringify(
    {
      ...result,
      objective,
      playerCount,
      parallel: process.env.AI_BENCH_PARALLEL !== '0',
      benchEngine: process.env.FLEET_BENCH_ENGINE ?? 'multi',
      weights: useClass1Star ? weightsPath : null,
    },
    null,
    2
  )
);
