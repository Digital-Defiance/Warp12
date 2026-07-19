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
  resolveModules,
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

  eta: {
    modules: {
      temporalDebt: true,
      temporalDebtCost: 2,
    },
    label: 'Module Eta (Temporal Debt)',
  },

  theta: {
    modules: {
      longestTrail: true,
      longestTrailBonus: -3,
    },
    label: 'Module Theta (Longest Trail)',
  },

  iota: {
    modules: {
      doubleDown: true,
      doubleDownDrawCount: 2,
    },
    label: 'Module Iota (Double Down)',
  },

  kappa: {
    modules: {
      temporalInversion: true,
    },
    label: 'Module Kappa (Temporal Inversion)',
  },

  lambda: {
    modules: {
      wormholes: true,
    },
    label: 'Module Lambda (Wormholes)',
  },

  mu: {
    modules: {
      subspaceFracture: true,
      subspaceFractureScope: 'own-trail',
    },
    label: 'Subspace Fracture (Own Trail)',
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

  // All modules enabled (stress test). Zeta is dropped at runtime when the
  // fleet cannot form equal squads (odd counts, or fewer than 4 captains).
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

/** Module Zeta needs ≥2 equal squads (even fleet ≥4 for squadronSize=2). */
function fleetSupportsSquadrons(
  playerCount: number,
  squadronSize = 2
): boolean {
  return playerCount >= squadronSize * 2 && playerCount % squadronSize === 0;
}

function resolveModulesForFleet(
  modules: GameModuleConfig | undefined,
  playerCount: number
): { modules?: GameModuleConfig; zetaOmitted: boolean } {
  if (!modules?.squadrons) {
    return { modules, zetaOmitted: false };
  }
  const squadronSize = modules.squadronSize ?? 2;
  if (fleetSupportsSquadrons(playerCount, squadronSize)) {
    return { modules, zetaOmitted: false };
  }
  return {
    modules: {
      ...modules,
      squadrons: false,
      squadronSize: undefined,
      squadronNames: undefined,
    },
    zetaOmitted: true,
  };
}

const config = MODULE_CONFIGS[MODULE_CONFIG];
if (!config) {
  console.error(`Unknown module config: ${MODULE_CONFIG}`);
  console.error(`Available: ${Object.keys(MODULE_CONFIGS).join(', ')}`);
  process.exit(1);
}

const { modules: resolvedModules, zetaOmitted } = resolveModulesForFleet(
  config.modules,
  PLAYER_COUNT
);

// Standalone zeta with an ineligible fleet: skip cleanly (shell already gates this,
// but keep a safe exit for manual runs).
if (MODULE_CONFIG === 'zeta' && zetaOmitted) {
  console.error(
    `\n=== W${WARP_FACTOR} · ${PLAYER_COUNT}p · ${config.label} ===`
  );
  console.error(
    `Skipping: Module Zeta needs an even fleet of ≥4 captains (got ${PLAYER_COUNT}).\n`
  );
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        warpFactor: WARP_FACTOR,
        playerCount: PLAYER_COUNT,
        moduleConfig: MODULE_CONFIG,
        objective: OBJECTIVE,
        skipped: true,
        reason: `zeta requires even playerCount >= 4 (got ${PLAYER_COUNT})`,
        games: 0,
      },
      null,
      2
    )
  );
  process.exit(0);
}

const label = zetaOmitted
  ? `${config.label} (Zeta omitted — fleet too small/uneven)`
  : config.label;

console.error(`\n=== W${WARP_FACTOR} · ${PLAYER_COUNT}p · ${label} ===`);
console.error(`Games: ${GAMES}, Objective: ${OBJECTIVE}\n`);

const startTime = Date.now();

// Run match with metrics collection
const matchResult = runSelfPlayMatch(
  (gameIndex) => {
    const seats = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const player = createWarpAiPlayer({
        skill: getWarpSkillProfile(
          'commander',
          OBJECTIVE,
          PLAYER_COUNT,
          undefined,
          resolveModules(resolvedModules ?? {})
        ),
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
    modules: resolvedModules,
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

// Calculate skill indicators (0–4). Thresholds are frozen absolute guards —
// keep in sync with docs/tei-paper.tex §9 and docs/MODULE-ANALYSIS.md.
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
  moduleLabel: label,
  zetaOmitted,
  games: GAMES,
  objective: OBJECTIVE,
  summary,
  skillIndicators,
  timestamp: new Date().toISOString(),
  durationSeconds: elapsed,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.error(`Results written to: ${OUTPUT_PATH}\n`);
