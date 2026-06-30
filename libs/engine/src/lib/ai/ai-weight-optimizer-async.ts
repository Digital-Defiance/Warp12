/**
 * Node-only parallel optimizer entry points (worker threads).
 * Not exported from the public warp12-engine browser bundle.
 */
import {
  runOptimizerMatchupsParallel,
  shouldParallelizeOptimizer,
} from './optimizer-parallel.js';
import {
  buildOptimizerScore,
  scoreGoOutPresets,
  TUNABLE_GO_OUT_WEIGHTS,
  type OptimizerOptions,
  type OptimizerScore,
} from './ai-weight-optimizer.js';
import {
  cloneGoOutPresets,
  type WarpSkillProfile,
} from './skill.js';

function cloneProfile(profile: WarpSkillProfile): WarpSkillProfile {
  return {
    ...profile,
    enabled: new Set(profile.enabled),
    weights: { ...profile.weights },
    goOutTuning: profile.goOutTuning ? { ...profile.goOutTuning } : undefined,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function scoreGoOutPresetsAsync(
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>,
  options: Pick<OptimizerOptions, 'games' | 'seed'>
): Promise<OptimizerScore> {
  if (!shouldParallelizeOptimizer()) {
    return scoreGoOutPresets(presets, options);
  }

  const batch = await runOptimizerMatchupsParallel(presets, {
    games: options.games,
    objective: 'go-out',
    seed: options.seed ?? 9001,
  });
  return buildOptimizerScore(batch);
}

export async function optimizeGoOutWeightsAsync(
  options: OptimizerOptions
): Promise<{
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>;
  score: OptimizerScore;
}> {
  const levels = options.levels ?? (['intermediate', 'advanced'] as const);
  const step = options.step ?? 0.08;
  const minWeight = options.minWeight ?? 0.2;
  const maxWeight = options.maxWeight ?? 4;
  const maxIterations = options.maxIterations ?? 12;

  let presets = cloneGoOutPresets();
  let best = await scoreGoOutPresetsAsync(presets, options);
  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (const level of levels) {
      for (const weightId of TUNABLE_GO_OUT_WEIGHTS) {
        if (!presets[level].enabled.has(weightId)) {
          continue;
        }
        const current = presets[level].weights[weightId] ?? 1;

        for (const delta of [step, -step]) {
          const nextWeight = clamp(current + delta, minWeight, maxWeight);
          if (nextWeight === current) {
            continue;
          }

          const trialPresets = {
            ...presets,
            [level]: cloneProfile(presets[level]),
          };
          trialPresets[level].weights = {
            ...trialPresets[level].weights,
            [weightId]: nextWeight,
          };

          const trialScore = await scoreGoOutPresetsAsync(trialPresets, options);
          if (trialScore.loss + 1e-9 < best.loss) {
            presets = trialPresets;
            best = trialScore;
            improved = true;
          }
        }
      }
    }
  }

  return { presets, score: best };
}
