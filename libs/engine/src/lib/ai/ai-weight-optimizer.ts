import {
  runCalibrationMatrix,
  runFourPlayerFocusMatchup,
  type SkillMatchupResult,
} from './ai-elo-calibration.js';
import { WARP_HEURISTIC_IDS } from './heuristics.js';
import {
  cloneGoOutPresets,
  setGoOutPresetsOverride,
  type WarpSkillLevel,
  type WarpSkillProfile,
} from './skill.js';

const H = WARP_HEURISTIC_IDS;

export const TUNABLE_GO_OUT_WEIGHTS: readonly string[] = [
  H.goOutWin,
  H.goOutTrailPriority,
  H.goOutNeutralZoneDump,
  H.goOutOpponentTrailDump,
  H.goOutAvoidMayhem,
  H.goOutBlockLeader,
  H.goOutDrawReluctance,
  H.goOutBeaconDiscipline,
  H.goOutFeasibility,
  H.handFlexibility,
];

export const GO_OUT_CALIBRATION_TARGETS = {
  beginnerVsIntermediate: 0.62,
  beginnerVsAdvanced: 0.78,
  intermediateVsAdvanced: 0.62,
  fourPlayerFocusMin: 0.26,
  fourPlayerAdvancedGap: 0.02,
} as const;

export interface OptimizerOptions {
  games: number;
  seed?: number;
  levels?: readonly WarpSkillLevel[];
  maxIterations?: number;
  step?: number;
  minWeight?: number;
  maxWeight?: number;
}

export interface OptimizerScore {
  loss: number;
  matrix: SkillMatchupResult[];
  focusAdvancedBeginner: number;
  focusIntermediateBeginner: number;
  focusAdvancedIntermediate: number;
}

function cloneProfile(profile: WarpSkillProfile): WarpSkillProfile {
  return {
    ...profile,
    enabled: new Set(profile.enabled),
    weights: { ...profile.weights },
    goOutTuning: profile.goOutTuning ? { ...profile.goOutTuning } : undefined,
  };
}

function matchup(
  matrix: SkillMatchupResult[],
  left: WarpSkillLevel,
  right: WarpSkillLevel
): SkillMatchupResult | undefined {
  return matrix.find((entry) => entry.left === left && entry.right === right);
}

export function buildOptimizerScore(input: {
  matrix: SkillMatchupResult[];
  focusAdvancedBeginner: number;
  focusIntermediateBeginner: number;
  focusAdvancedIntermediate: number;
}): OptimizerScore {
  const {
    matrix,
    focusAdvancedBeginner,
    focusIntermediateBeginner,
    focusAdvancedIntermediate,
  } = input;

  const bI = matchup(matrix, 'beginner', 'intermediate');
  const bA = matchup(matrix, 'beginner', 'advanced');
  const iA = matchup(matrix, 'intermediate', 'advanced');

  let loss = 0;
  const targets = GO_OUT_CALIBRATION_TARGETS;

  const addTarget = (
    rate: number | null | undefined,
    target: number,
    weight: number
  ) => {
    if (rate === null || rate === undefined) {
      loss += weight * 4;
      return;
    }
    loss += weight * (rate - target) ** 2;
  };

  addTarget(bI?.higherSkillWinRate, targets.beginnerVsIntermediate, 3);
  addTarget(bA?.higherSkillWinRate, targets.beginnerVsAdvanced, 2);
  addTarget(iA?.higherSkillWinRate, targets.intermediateVsAdvanced, 3);

  if (focusAdvancedBeginner < targets.fourPlayerFocusMin) {
    loss += (targets.fourPlayerFocusMin - focusAdvancedBeginner) ** 2 * 8;
  }
  if (focusIntermediateBeginner < targets.fourPlayerFocusMin) {
    loss += (targets.fourPlayerFocusMin - focusIntermediateBeginner) ** 2 * 6;
  }
  if (focusAdvancedIntermediate < targets.fourPlayerFocusMin) {
    loss += (targets.fourPlayerFocusMin - focusAdvancedIntermediate) ** 2 * 6;
  }
  if (
    focusAdvancedBeginner <
    focusIntermediateBeginner + targets.fourPlayerAdvancedGap
  ) {
    loss +=
      (focusIntermediateBeginner +
        targets.fourPlayerAdvancedGap -
        focusAdvancedBeginner) **
        2 *
      10;
  }

  for (const result of matrix) {
    if (result.left === result.right || result.seatAWinRate === null) {
      continue;
    }
    if (result.seatAWinRate < 0.35 || result.seatAWinRate > 0.65) {
      loss += 0.05;
    }
  }

  return {
    loss,
    matrix,
    focusAdvancedBeginner,
    focusIntermediateBeginner,
    focusAdvancedIntermediate,
  };
}

export function scoreGoOutPresets(
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>,
  options: Pick<OptimizerOptions, 'games' | 'seed'>
): OptimizerScore {
  setGoOutPresetsOverride(presets);
  try {
    const matrix = runCalibrationMatrix({
      games: options.games,
      objective: 'go-out',
      seed: options.seed ?? 9001,
    });

    const focusAdvancedBeginner = runFourPlayerFocusMatchup(
      'advanced',
      'beginner',
      {
        games: options.games,
        objective: 'go-out',
        seed: options.seed ?? 9001,
      }
    ).focusWinRate;
    const focusIntermediateBeginner = runFourPlayerFocusMatchup(
      'intermediate',
      'beginner',
      {
        games: options.games,
        objective: 'go-out',
        seed: options.seed ?? 9001,
      }
    ).focusWinRate;
    const focusAdvancedIntermediate = runFourPlayerFocusMatchup(
      'advanced',
      'intermediate',
      {
        games: options.games,
        objective: 'go-out',
        seed: options.seed ?? 9001,
      }
    ).focusWinRate;

    return buildOptimizerScore({
      matrix,
      focusAdvancedBeginner,
      focusIntermediateBeginner,
      focusAdvancedIntermediate,
    });
  } finally {
    setGoOutPresetsOverride(null);
  }
}

export function formatOptimizerScore(score: OptimizerScore): string {
  const bI = matchup(score.matrix, 'beginner', 'intermediate');
  const bA = matchup(score.matrix, 'beginner', 'advanced');
  const iA = matchup(score.matrix, 'intermediate', 'advanced');
  const lines = [
    `loss=${score.loss.toFixed(4)}`,
    `B→I ${pct(bI?.higherSkillWinRate)} (target ${pct(GO_OUT_CALIBRATION_TARGETS.beginnerVsIntermediate)})`,
    `B→A ${pct(bA?.higherSkillWinRate)} (target ${pct(GO_OUT_CALIBRATION_TARGETS.beginnerVsAdvanced)})`,
    `I→A ${pct(iA?.higherSkillWinRate)} (target ${pct(GO_OUT_CALIBRATION_TARGETS.intermediateVsAdvanced)})`,
    `4p adv/beg ${pct(score.focusAdvancedBeginner)}`,
    `4p int/beg ${pct(score.focusIntermediateBeginner)}`,
    `4p adv/int ${pct(score.focusAdvancedIntermediate)}`,
  ];
  return lines.join(' | ');
}

function pct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) {
    return '—';
  }
  return `${(rate * 100).toFixed(1)}%`;
}

export function optimizeGoOutWeights(
  options: OptimizerOptions
): {
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>;
  score: OptimizerScore;
} {
  return optimizeGoOutWeightsWithScorer(options, scoreGoOutPresets);
}

function optimizeGoOutWeightsWithScorer(
  options: OptimizerOptions,
  scorePresets: typeof scoreGoOutPresets
): {
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>;
  score: OptimizerScore;
} {
  const levels = options.levels ?? (['intermediate', 'advanced'] as const);
  const step = options.step ?? 0.08;
  const minWeight = options.minWeight ?? 0.2;
  const maxWeight = options.maxWeight ?? 4;
  const maxIterations = options.maxIterations ?? 12;

  let presets = cloneGoOutPresets();
  let best = scorePresets(presets, options);
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

          const trialScore = scorePresets(trialPresets, options);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatPresetWeights(
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>
): string {
  const lines: string[] = [];
  for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
    lines.push(`\n${level}:`);
    for (const id of TUNABLE_GO_OUT_WEIGHTS) {
      if (!presets[level].enabled.has(id)) {
        continue;
      }
      lines.push(`  ${id}: ${presets[level].weights[id] ?? 1}`);
    }
    if (presets[level].goOutTuning) {
      lines.push(`  tuning: ${JSON.stringify(presets[level].goOutTuning)}`);
    }
  }
  return lines.join('\n');
}
