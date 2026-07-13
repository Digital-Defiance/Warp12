#!/usr/bin/env node
/**
 * Collect luck/skill metrics for a single Warp factor (parallelization unit).
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  warpSetProfile,
  runSelfPlayMatch,
  createWarpAiPlayer,
  type WarpFactor,
  type GameLuckSkillMetrics,
} from 'warp12-engine';

const WARP_FACTOR = Number(process.env.COMPREHENSIVE_WARP_FACTOR ?? 12) as WarpFactor;
const GAMES = Number(process.env.COMPREHENSIVE_GAMES ?? 500);
const OBJECTIVE = (process.env.COMPREHENSIVE_OBJECTIVE ?? 'points') as 'points' | 'go-out';
const SEED = Number(process.env.COMPREHENSIVE_SEED ?? 9001);
const OUTPUT_PATH = process.env.COMPREHENSIVE_OUTPUT ?? `tools/nn/data/luck-skill-w${WARP_FACTOR}.json`;

console.error(`\n=== Warp ${WARP_FACTOR} Worker ===`);
console.error(`Games/config: ${GAMES}`);
console.error(`Objective: ${OBJECTIVE}`);
console.error(`Seed: ${SEED}`);
console.error(``);

const profile = warpSetProfile(WARP_FACTOR);
const results: Array<{
  maxPip: number;
  playerCount: number;
  objective: 'points' | 'go-out';
  games: number;
  completed: number;
  metrics: GameLuckSkillMetrics[];
}> = [];

for (let playerCount = profile.minPlayers; playerCount <= profile.maxPlayers; playerCount++) {
  const configSeed = SEED + (WARP_FACTOR * 1000) + (playerCount * 100);
  
  console.error(`  W${WARP_FACTOR} @ ${playerCount}p - collecting ${GAMES} games...`);
  
  const matchResult = runSelfPlayMatch(
    (gameIndex) => {
      const seats = [];
      for (let i = 0; i < playerCount; i++) {
        const player = createWarpAiPlayer({
          skill: 'commander',
          lookahead: {
            kind: 'ismcts',
            iterations: 800,
            rng: () => Math.random(),
          },
          rng: () => Math.random(),
          objective: OBJECTIVE,
        });
        seats.push({
          id: `p${i}` as const,
          displayName: `Captain ${i}`,
          player,
        });
      }
      return seats;
    },
    {
      games: GAMES,
      seed: configSeed,
      modules: undefined, // Use default spacedock based on maxPip
      objective: OBJECTIVE,
      maxPip: WARP_FACTOR,
      collectMetrics: true,
    }
  );
  
  console.error(`    ✓ ${matchResult.completed}/${matchResult.games} games completed`);
  
  results.push({
    maxPip: WARP_FACTOR,
    playerCount,
    objective: OBJECTIVE,
    games: GAMES,
    completed: matchResult.completed,
    metrics: matchResult.gameMetrics ?? [],
  });
}

writeFileSync(
  OUTPUT_PATH,
  JSON.stringify({
    maxPip: WARP_FACTOR,
    objective: OBJECTIVE,
    gamesPerConfig: GAMES,
    totalConfigs: results.length,
    results,
  }, null, 2)
);

console.error(`✓ W${WARP_FACTOR} complete - ${results.length} configs, output: ${OUTPUT_PATH}`);
