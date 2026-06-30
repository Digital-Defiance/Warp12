import { describe, expect, it } from 'vitest';

import {
  formatOptimizerScore,
  formatPresetWeights,
  optimizeGoOutWeights,
  scoreGoOutPresets,
} from './ai-weight-optimizer.js';
import {
  optimizeGoOutWeightsAsync,
  scoreGoOutPresetsAsync,
} from './ai-weight-optimizer-async.js';
import { WARP_HEURISTIC_IDS } from './heuristics.js';
import { cloneGoOutPresets } from './skill.js';

const H = WARP_HEURISTIC_IDS;

const OPTIMIZER_GAMES = Number(process.env.AI_OPTIMIZER_GAMES ?? 40);
const OPTIMIZER_SEED = 9001;
const OPTIMIZER_PRINT_TIMEOUT_MS = Number(
  process.env.AI_OPTIMIZER_TIMEOUT_MS ??
    Math.max(
      600_000,
      Number(process.env.AI_OPTIMIZER_GAMES ?? 150) *
        Number(process.env.AI_OPTIMIZER_ITERATIONS ?? 10) *
        200 +
        600_000
    )
);

describe('AI weight optimizer', () => {
  it('scores baseline go-out presets without crashing', () => {
    const presets = cloneGoOutPresets();
    const score = scoreGoOutPresets(presets, {
      games: OPTIMIZER_GAMES,
      seed: OPTIMIZER_SEED,
    });
    expect(score.loss).toBeGreaterThanOrEqual(0);
    expect(score.matrix.length).toBeGreaterThan(0);
  });

  it('completes a short coordinate pass with finite loss', () => {
    const baseline = scoreGoOutPresets(cloneGoOutPresets(), {
      games: OPTIMIZER_GAMES,
      seed: OPTIMIZER_SEED,
    });
    const { score, presets } = optimizeGoOutWeights({
      games: OPTIMIZER_GAMES,
      seed: OPTIMIZER_SEED,
      maxIterations: 2,
      step: 0.12,
    });
    expect(Number.isFinite(score.loss)).toBe(true);
    expect(presets.lieutenant.weights[H.goOutWin]).toBeGreaterThan(0);
    expect(score.loss).toBeLessThanOrEqual(baseline.loss + 0.12);
  }, 300_000);

  it('prints optimizer output when AI_WEIGHT_OPTIMIZE=1', async () => {
    if (process.env.AI_WEIGHT_OPTIMIZE !== '1') {
      return;
    }

    const games = Number(process.env.AI_OPTIMIZER_GAMES ?? 150);
    const iterations = Number(process.env.AI_OPTIMIZER_ITERATIONS ?? 10);
    const useParallel = process.env.AI_OPTIMIZER_PARALLEL !== '0';
    const scoreFn = useParallel ? scoreGoOutPresetsAsync : scoreGoOutPresets;
    const optimizeFn = useParallel
      ? optimizeGoOutWeightsAsync
      : optimizeGoOutWeights;

    const baseline = await scoreFn(cloneGoOutPresets(), {
      games,
      seed: OPTIMIZER_SEED,
    });
    // eslint-disable-next-line no-console
    console.log('\n=== baseline ===');
    // eslint-disable-next-line no-console
    console.log(formatOptimizerScore(baseline));

    const { presets, score } = await optimizeFn({
      games,
      seed: OPTIMIZER_SEED,
      maxIterations: iterations,
    });
    // eslint-disable-next-line no-console
    console.log('\n=== optimized ===');
    // eslint-disable-next-line no-console
    console.log(formatOptimizerScore(score));
    // eslint-disable-next-line no-console
    console.log(formatPresetWeights(presets));
  }, OPTIMIZER_PRINT_TIMEOUT_MS);
});
