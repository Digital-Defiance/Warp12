#!/usr/bin/env node
/**
 * Comprehensive luck vs skill data collection across all Warp factors.
 * 
 * Collects metrics for publication-quality analysis of skill ceiling degradation
 * across domino set sizes (W3-W18) and fleet sizes (2-maxFleet).
 * 
 * Usage:
 *   COMPREHENSIVE_GAMES=500 COMPREHENSIVE_WORKERS=1 \
 *   node --loader tsx tools/nn/collect-luck-skill-comprehensive.ts
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  warpSetProfile,
  WARP_FACTORS,
  type WarpFactor,
} from '../../libs/engine/src/lib/constants/warp-set.js';
import {
  createWarpAiPlayer,
  getWarpSkillProfile,
  resolveWarpLookahead,
  runSelfPlayMatch,
  summarizeLuckSkillMetrics,
  type GameLuckSkillMetrics,
  type GameObjective,
} from '../../libs/engine/src/lib/ai/index.js';

// Configuration
const GAMES_PER_CONFIG = Number(process.env.COMPREHENSIVE_GAMES ?? 500);
const OBJECTIVE: GameObjective = (process.env.COMPREHENSIVE_OBJECTIVE ?? 'points') as GameObjective;
const BASE_SEED = Number(process.env.COMPREHENSIVE_SEED ?? 9001);
const OUTPUT_PATH = resolve(
  process.cwd(),
  process.env.COMPREHENSIVE_OUTPUT ?? 'tools/nn/data/luck-skill-comprehensive.json'
);

// Warp factors to test (skip W0-W2 as too small)
const TEST_FACTORS: WarpFactor[] = [3, 6, 9, 12, 15, 18];

interface ComprehensiveResult {
  maxPip: number;
  playerCount: number;
  objective: GameObjective;
  games: number;
  completed: number;
  
  // Skill metrics
  avgLegalMovesPerTurn: number;
  avgUniqueTrainsPerTurn: number;
  avgConstrainedTileFraction: number;
  avgUniquePipsInHand: number;
  avgMaxPipCluster: number;
  avgHandEntropy: number;
  avgMoveValueSpread: number;
  avgNearOptimalFraction: number;
  avgOwnTrailPlayRate: number;
  avgShieldsDownRate: number;
  
  // Derived
  skillIndex: number; // 0-4 count of indicators exceeding thresholds
  skillIndicators: {
    highConstraints: boolean;  // >50%
    lowEntropy: boolean;       // <3.0 bits
    wideSpread: boolean;       // >15 pips
    highOwnTrail: boolean;     // >40%
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeSkillIndicators(summary: ReturnType<typeof summarizeLuckSkillMetrics>) {
  const indicators = {
    highConstraints: summary.avgConstrainedTileFraction > 0.5,
    lowEntropy: summary.avgHandEntropy < 3.0,
    wideSpread: summary.avgMoveValueSpread > 15,
    highOwnTrail: summary.avgOwnTrailPlayRate > 0.4,
  };
  
  const skillIndex = Object.values(indicators).filter(Boolean).length;
  
  return { indicators, skillIndex };
}

async function collectConfig(
  maxPip: WarpFactor,
  playerCount: number
): Promise<ComprehensiveResult | null> {
  const profile = warpSetProfile(maxPip);
  
  // Build Commander seats
  const seats = Array.from({ length: playerCount }, (_, i) => {
    const id = String.fromCharCode(97 + i) as import('../../libs/engine/src/lib/types/player.js').PlayerId;
    return {
      id,
      displayName: `Cdr-${id}`,
      player: createWarpAiPlayer({
        skill: getWarpSkillProfile('commander', OBJECTIVE, playerCount),
        objective: OBJECTIVE,
        lookahead: resolveWarpLookahead('commander', OBJECTIVE, playerCount),
        rng: mulberry32(BASE_SEED + maxPip * 1000 + playerCount * 100 + i),
      }),
    };
  });
  
  console.error(`  Collecting W${maxPip} @ ${playerCount}p...`);
  
  try {
    const result = runSelfPlayMatch(
      (gameIndex) => {
        // Re-seed players per game for determinism
        return seats.map((s, i) => ({
          ...s,
          player: createWarpAiPlayer({
            skill: getWarpSkillProfile('commander', OBJECTIVE, playerCount),
            objective: OBJECTIVE,
            lookahead: resolveWarpLookahead('commander', OBJECTIVE, playerCount),
            rng: mulberry32(BASE_SEED + maxPip * 1000 + playerCount * 100 + gameIndex * 10 + i),
          }),
        }));
      },
      {
        games: GAMES_PER_CONFIG,
        seed: BASE_SEED + maxPip * 1000 + playerCount * 100,
        objective: OBJECTIVE,
        maxPip,
        collectMetrics: true, // <<< KEY FLAG
      }
    );
    
    // Extract metrics from completed games
    const gameMetrics: GameLuckSkillMetrics[] = [];
    // Note: runSelfPlayMatch doesn't currently return per-game metrics
    // We need to use playSelfPlayGame directly in a loop
    
    console.error(`    ⚠ Note: Full metrics collection requires engine update`);
    console.error(`    Completed: ${result.completed}/${result.games} games`);
    
    // For now, return null to indicate we need the engine update
    return null;
    
  } catch (error) {
    console.error(`    ✗ Failed: ${error}`);
    return null;
  }
}

async function main() {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  COMPREHENSIVE LUCK vs SKILL DATA COLLECTION');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error(`Objective: ${OBJECTIVE}`);
  console.error(`Games/config: ${GAMES_PER_CONFIG}`);
  console.error(`Warp factors: ${TEST_FACTORS.join(', ')}`);
  console.error(`Output: ${OUTPUT_PATH}`);
  console.error('');
  
  const results: ComprehensiveResult[] = [];
  let totalConfigs = 0;
  let totalGames = 0;
  
  for (const maxPip of TEST_FACTORS) {
    const profile = warpSetProfile(maxPip);
    console.error(`\n=== Warp ${maxPip} (${profile.tileCount} tiles) ===`);
    
    for (let playerCount = profile.minPlayers; playerCount <= profile.maxPlayers; playerCount++) {
      totalConfigs++;
      totalGames += GAMES_PER_CONFIG;
      
      const result = await collectConfig(maxPip, playerCount);
      
      if (result) {
        results.push(result);
      }
    }
  }
  
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error(`Total configs: ${totalConfigs}`);
  console.error(`Total games: ${totalGames.toLocaleString()}`);
  console.error(`Collected: ${results.length} configs`);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error(`⚠ IMPLEMENTATION NOTE:`);
  console.error(`  runSelfPlayMatch needs to return per-game metrics.`);
  console.error(`  Update required in libs/engine/src/lib/ai/self-play.ts`);
  console.error('');
  
  // Save what we have
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        metadata: {
          objective: OBJECTIVE,
          gamesPerConfig: GAMES_PER_CONFIG,
          baseSeed: BASE_SEED,
          collectedAt: new Date().toISOString(),
          warpFactors: TEST_FACTORS,
          totalConfigs,
          totalGames,
        },
        results,
      },
      null,
      2
    )
  );
  
  console.error(`✓ Results saved to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
