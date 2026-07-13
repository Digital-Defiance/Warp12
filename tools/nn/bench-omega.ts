import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { benchOmegaParallel } from '../../libs/engine/src/lib/ai/bench-omega-parallel.ts';
import {
  validateOmegaModelWeights,
  type OmegaModelWeights,
} from '../../libs/engine/src/lib/ai/index.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.OMEGA_BENCH_GAMES ?? 200);
const seed = Number(process.env.OMEGA_BENCH_SEED ?? 42);
const objective = (process.env.OMEGA_OBJECTIVE ?? 'points') as GameObjective;
const collectMetrics = process.env.OMEGA_COLLECT_METRICS === '1' || process.env.OMEGA_COLLECT_METRICS === 'true';
const weightsPath =
  process.env.OMEGA_WEIGHTS ??
  resolve(repoRoot, 'apps/Warp12/public/models/omega-v1.json');

/** Player counts to sweep — the promotion gate must hold across all of these. */
const playerCounts = (process.env.OMEGA_BENCH_PLAYERS ?? '2,3,4')
  .split(',')
  .map((part) => Number(part.trim()))
  .filter((value) => Number.isFinite(value) && value >= 2);

const raw = readFileSync(weightsPath, 'utf8');
const net = JSON.parse(raw) as OmegaModelWeights;
validateOmegaModelWeights(net);

const results = [];
for (const playerCount of playerCounts) {
  // Both seats to cancel first-mover bias at 2p; seat 'a' only for 3+ (symmetry
  // across many opponents is diluted anyway).
  const seatIds = playerCount === 2 ? (['a', 'b'] as const) : (['a'] as const);
  for (const omegaSeatId of seatIds) {
    results.push(
      await benchOmegaParallel({
        options: {
          games,
          net,
          seed,
          objective,
          playerCount,
          omegaSeatId,
          collectMetrics,
        },
      })
    );
  }
}

console.log(
  JSON.stringify(
    { weights: weightsPath, objective, gamesPerSlice: games, results },
    null,
    2
  )
);

// If metrics were collected, print a summary to stderr for visibility
if (collectMetrics && results.length > 0 && results[0].luckSkillMetrics) {
  console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  LUCK vs SKILL METRICS SUMMARY');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  for (const result of results) {
    const m = result.luckSkillMetrics;
    if (!m) continue;
    
    console.error(`\n[${m.playerCount}p ${m.objective.toUpperCase()} @ Warp ${m.maxPip}]`);
    console.error(`  Games: ${m.games}  Turns sampled: ${results[0].completed * 100} (approx)`);
    console.error('');
    console.error('  DECISION COMPLEXITY:');
    console.error(`    Avg legal moves/turn:     ${m.avgLegalMovesPerTurn.toFixed(2)}`);
    console.error(`    Avg playable trains/turn: ${m.avgUniqueTrainsPerTurn.toFixed(2)}`);
    console.error(`    Constrained tiles:        ${(m.avgConstrainedTileFraction * 100).toFixed(1)}%`);
    console.error('');
    console.error('  HAND COHERENCE:');
    console.error(`    Avg unique pips in hand:  ${m.avgUniquePipsInHand.toFixed(2)} / ${m.maxPip + 1}`);
    console.error(`    Avg max pip cluster:      ${m.avgMaxPipCluster.toFixed(2)} tiles`);
    console.error(`    Avg hand entropy:         ${m.avgHandEntropy.toFixed(3)} bits`);
    console.error('');
    console.error('  STRATEGIC DEPTH:');
    console.error(`    Avg move value spread:    ${m.avgMoveValueSpread.toFixed(2)} pips`);
    console.error(`    Near-optimal moves:       ${(m.avgNearOptimalFraction * 100).toFixed(1)}%`);
    console.error('');
    console.error('  TRAIL DEVELOPMENT:');
    console.error(`    Own trail play rate:      ${(m.avgOwnTrailPlayRate * 100).toFixed(1)}%`);
    console.error(`    Shields down rate:        ${(m.avgShieldsDownRate * 100).toFixed(1)}%`);
    
    // Interpretation hints
    console.error('');
    console.error('  INTERPRETATION:');
    if (m.avgNearOptimalFraction > 0.7) {
      console.error(`    ⚠ High near-optimal fraction (${(m.avgNearOptimalFraction * 100).toFixed(0)}%) → most moves similar quality`);
    }
    if (m.avgConstrainedTileFraction < 0.3) {
      console.error(`    ⚠ Low constraint (${(m.avgConstrainedTileFraction * 100).toFixed(0)}%) → flexible tile placement`);
    }
    if (m.avgOwnTrailPlayRate < 0.3) {
      console.error(`    ⚠ Low own-trail rate (${(m.avgOwnTrailPlayRate * 100).toFixed(0)}%) → can't build coherent strategy`);
    }
    if (m.avgHandEntropy > Math.log2(m.maxPip + 1) * 0.8) {
      console.error(`    ⚠ High entropy (${m.avgHandEntropy.toFixed(2)} bits) → fragmented hands`);
    }
    
    const skillIndicators = [
      m.avgNearOptimalFraction < 0.6,
      m.avgConstrainedTileFraction > 0.4,
      m.avgOwnTrailPlayRate > 0.4,
      m.avgHandEntropy < Math.log2(m.maxPip + 1) * 0.7,
    ].filter(Boolean).length;
    
    if (skillIndicators >= 3) {
      console.error(`    ✓ Configuration shows SKILL DOMINANCE (${skillIndicators}/4 indicators)`);
    } else if (skillIndicators <= 1) {
      console.error(`    ✗ Configuration shows LUCK DOMINANCE (${4 - skillIndicators}/4 luck indicators)`);
    } else {
      console.error(`    ~ Mixed skill/luck balance (${skillIndicators}/4 skill indicators)`);
    }
  }
  
  console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
