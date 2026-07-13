#!/usr/bin/env node
/**
 * Collect luck/skill metrics for a specific Warp factor, player count, AND module config.
 * 
 * Usage:
 *   MODULE_WARP_FACTOR=12 MODULE_PLAYER_COUNT=4 MODULE_CONFIG="alpha" \
 *   MODULE_GAMES=500 npx tsx tools/nn/collect-luck-skill-modules.ts
 */

import {
  runSelfPlayMatch,
  createWarpAiPlayer,
  getWarpSkillProfile,
  resolveWarpLookahead,
  summarizeLuckSkillMetrics,
  type WarpFactor,
  type GameLuckSkillMetrics,
  type GameObjective,
  type GameModuleConfig,
  type HouseRulesConfig,
} from 'warp12-engine';
import { writeFileSync } from 'node:fs';

const WARP_FACTOR = Number(process.env.MODULE_WARP_FACTOR ?? 12) as WarpFactor;
const PLAYER_COUNT = Number(process.env.MODULE_PLAYER_COUNT ?? 4);
const MODULE_CONFIG = process.env.MODULE_CONFIG ?? 'none';
const GAMES = Number(process.env.MODULE_GAMES ?? 500);
const OBJECTIVE = (process.env.MODULE_OBJECTIVE ?? 'points') as GameObjective;
const BASE_SEED = Number(process.env.MODULE_SEED ?? 9001);
const OUTPUT_PATH = process.env.MODULE_OUTPUT ?? 
  `tools/nn/data/luck-skill-w${WARP_FACTOR}-p${PLAYER_COUNT}-m${MODULE_CONFIG}.json`;

// Module configurations to test
const MODULE_CONFIGS: Record<string, { modules?: GameModuleConfig; houseRules?: HouseRulesConfig; label: string }> = {
  // Baseline
  none: {
    label: 'Baseline (no modules)',
  },

  // Individual modules (Alpha through Zeta)
  alpha: {
    modules: {
      continuum: true,
    },
    label: 'Module Alpha (Continuum)',
  },

  beta: {
    modules: {
      salamanderPenalty: true,
    },
    label: 'Module Beta (Salamander Penalty)',
  },

  gamma: {
    modules: {
      sensorGrid: true,
      sensorGridSize: 5,
    },
    label: 'Module Gamma (Sensor Grid)',
  },

  delta: {
    modules: {
      warpDriveSpool: true,
    },
    label: 'Module Delta (Warp Drive Spool)',
  },

  epsilon: {
    modules: {
      drafting: true,
      // Pack size will be calculated automatically based on player count
      // Formula: floor((total_tiles - 1) / player_count) leaves tiles for uncharted
    },
    label: 'Module Epsilon (Drafting)',
  },

  zeta: {
    modules: {
      squadrons: true,
      squadronSize: 2,
    },
    label: 'Module Zeta (Squadrons)',
  },

  // Official Warp preset
  official: {
    modules: {
      continuum: true,
      salamanderPenalty: true,
    },
    houseRules: {
      dropToImpulseCall: true,
      dropToImpulseCatchPenalty: 1,
      allStopCeremony: true,
      doubleZeroScore: 0,
    },
    label: 'Official Warp 12 Preset',
  },

  // All modules enabled (stress test)
  all: {
    modules: {
      continuum: true,
      salamanderPenalty: true,
      sensorGrid: true,
      sensorGridSize: 5,
      warpDriveSpool: true,
      // drafting: false, // Disabled - incompatible with other modules
      squadrons: true,
      squadronSize: 2,
      longestTrail: true,
      longestTrailBonus: -3,
      doubleDown: true,
      doubleDownDrawCount: 2,
      temporalDebt: true,
      temporalDebtCost: 2,
      temporalInversion: true,
      wormholes: true,
      subspaceFracture: true,
      subspaceFractureScope: 'all-doubles',
    },
    label: 'All Modules (stress test)',
  },
};

const config = MODULE_CONFIGS[MODULE_CONFIG];
if (!config) {
  console.error(`Unknown module config: ${MODULE_CONFIG}`);
  console.error(`Available: ${Object.keys(MODULE_CONFIGS).join(', ')}`);
  process.exit(1);
}

console.error(`\n=== W${WARP_FACTOR} · ${PLAYER_COUNT}p · ${config.label} ===`);
console.error(`Games: ${GAMES}, Objective: ${OBJECTIVE}\n`);

const startTime = Date.now();

// Run match with metrics collection
const matchResult = runSelfPlayMatch(
  (gameIndex) => {
    const seats = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const player = createWarpAiPlayer({
        skill: getWarpSkillProfile('commander', OBJECTIVE, PLAYER_COUNT),
        lookahead: resolveWarpLookahead('commander', OBJECTIVE, PLAYER_COUNT),
        rng: () => Math.random(),
        objective: OBJECTIVE,
      });
      seats.push({
        id: `p${i}` as const,
        displayName: `Captain-${i}`,
        player,
      });
    }
    return seats;
  },
  {
    games: GAMES,
    seed: BASE_SEED,
    modules: config.modules,
    houseRules: config.houseRules,
    objective: OBJECTIVE,
    maxPip: WARP_FACTOR,
    collectMetrics: true,
  }
);

const elapsed = (Date.now() - startTime) / 1000;
console.error(`\n✓ Completed ${matchResult.completed}/${GAMES} games in ${elapsed.toFixed(1)}s`);

const gameMetrics = matchResult.gameMetrics ?? [];

// Summarize metrics
const summary = summarizeLuckSkillMetrics(
  gameMetrics,
  PLAYER_COUNT,
  WARP_FACTOR,
  OBJECTIVE
);

// Calculate skill indicators
const skillIndicators = [
  summary.avgLegalMovesPerTurn >= 3.0,
  summary.avgConstrainedTileFraction > 0.5,
  summary.avgMoveValueSpread >= 2.0,
  summary.avgUniquePipsInHand >= 5.0,
].filter(Boolean).length;

console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.error('  LUCK vs SKILL SUMMARY');
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.error(`  Avg legal moves: ${summary.avgLegalMovesPerTurn.toFixed(2)}`);
console.error(`  Avg constrained tiles: ${(summary.avgConstrainedTileFraction * 100).toFixed(1)}%`);
console.error(`  Avg move value spread: ${summary.avgMoveValueSpread.toFixed(2)}`);
console.error(`  Avg unique pips: ${summary.avgUniquePipsInHand.toFixed(2)}`);
console.error(`  Skill indicators: ${skillIndicators}/4`);

if (skillIndicators >= 3) {
  console.error(`  ✓ SKILL DOMINANT configuration`);
} else if (skillIndicators <= 1) {
  console.error(`  ✗ LUCK DOMINANT configuration`);
} else {
  console.error(`  ~ MIXED skill/luck balance`);
}
console.error('');

// Write results
const output = {
  warpFactor: WARP_FACTOR,
  playerCount: PLAYER_COUNT,
  moduleConfig: MODULE_CONFIG,
  moduleLabel: config.label,
  games: GAMES,
  objective: OBJECTIVE,
  summary,
  skillIndicators,
  timestamp: new Date().toISOString(),
  durationSeconds: elapsed,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.error(`Results written to: ${OUTPUT_PATH}\n`);
