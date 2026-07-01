/**
 * Head-to-head: Fleet Admiral expectimax vs ISMCTS on the same seat count.
 * Uses explicit engine presets (not multi-engine routing).
 */
import { benchFleetAdmiralVsCommander } from '../../libs/engine/src/lib/ai/bench-fleet-admiral.ts';
import {
  resolveFleetAdmiralExpectimaxLookahead,
  resolveFleetAdmiralIsmctsLookahead,
} from '../../libs/engine/src/lib/ai/fleet-admiral.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const games = Number(process.env.FLEET_BENCH_GAMES ?? 30);
const seed = Number(process.env.FLEET_BENCH_SEED ?? 42);
const playerCount = Number(process.env.CLASS1_STAR_PLAYERS ?? 2);
const objective = (process.env.CLASS1_STAR_OBJECTIVE ?? 'points') as GameObjective;

const ismcts = benchFleetAdmiralVsCommander({
  games,
  seed,
  objective,
  playerCount,
  fleetLookahead: resolveFleetAdmiralIsmctsLookahead(objective, playerCount),
});

const expectimax = benchFleetAdmiralVsCommander({
  games,
  seed: seed + 1,
  objective,
  playerCount,
  fleetLookahead: resolveFleetAdmiralExpectimaxLookahead(objective, playerCount),
});

console.log(
  JSON.stringify(
    {
      ismcts: {
        wins: ismcts.fleetAdmiralWins,
        losses: ismcts.commanderWins,
        rate: ismcts.fleetAdmiralWinRate,
        searchEngine: 'ismcts',
        fleetLookahead: ismcts.fleetLookahead,
      },
      expectimax: {
        wins: expectimax.fleetAdmiralWins,
        losses: expectimax.commanderWins,
        rate: expectimax.fleetAdmiralWinRate,
        searchEngine: 'expectimax',
        fleetLookahead: expectimax.fleetLookahead,
      },
      games,
      objective,
      playerCount,
    },
    null,
    2
  )
);
