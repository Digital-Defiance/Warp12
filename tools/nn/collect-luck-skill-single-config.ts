#!/usr/bin/env node
/**
 * Collect luck/skill metrics for a single configuration (maxPip + playerCount).
 * Finest-grained parallelization unit for maximum worker utilization.
 */

import { writeFileSync } from 'node:fs';
import {
  runSelfPlayMatch,
  createWarpAiPlayer,
  warpSetProfile,
  type WarpFactor,
  type GameLuckSkillMetrics,
} from 'warp12-engine';

const WARP_FACTOR = Number(process.env.CONFIG_WARP_FACTOR ?? 12) as WarpFactor;
const PLAYER_COUNT = Number(process.env.CONFIG_PLAYER_COUNT ?? 4);
const GAMES = Number(process.env.CONFIG_GAMES ?? 500);
const OBJECTIVE = (process.env.CONFIG_OBJECTIVE ?? 'points') as 'points' | 'go-out';
const SEED = Number(process.env.CONFIG_SEED ?? 9001);
const OUTPUT_PATH = process.env.CONFIG_OUTPUT ?? `tools/nn/data/luck-skill-w${WARP_FACTOR}-p${PLAYER_COUNT}.json`;

const configSeed = SEED + (WARP_FACTOR * 1000) + (PLAYER_COUNT * 100);

console.error(`W${WARP_FACTOR} @ ${PLAYER_COUNT}p - collecting ${GAMES} ${OBJECTIVE} games...`);

const matchResult = runSelfPlayMatch(
  (gameIndex) => {
    const seats = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
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

const result = {
  maxPip: WARP_FACTOR,
  playerCount: PLAYER_COUNT,
  objective: OBJECTIVE,
  games: GAMES,
  completed: matchResult.completed,
  metrics: matchResult.gameMetrics ?? [],
};

writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

console.error(`✓ W${WARP_FACTOR} @ ${PLAYER_COUNT}p: ${matchResult.completed}/${GAMES} games -> ${OUTPUT_PATH}`);
