import { availableParallelism } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Worker } from 'node:worker_threads';

import type { GameObjective } from '../types/objective.js';
import {
  runFourPlayerFocusMatchup,
  runSkillMatchup,
  SKILL_MATCHUPS,
  type SkillMatchupResult,
} from './ai-elo-calibration.js';
import {
  cloneGoOutPresets,
  setGoOutPresetsOverride,
  type WarpSkillLevel,
  type WarpSkillProfile,
} from './skill.js';

export interface ParallelMatchupJob {
  readonly kind: 'h2h' | 'focus';
  readonly left?: WarpSkillLevel;
  readonly right?: WarpSkillLevel;
  readonly focus?: WarpSkillLevel;
  readonly opponents?: WarpSkillLevel;
}

export interface SerializedWarpSkillProfile {
  readonly enabled: readonly string[];
  readonly weights: Record<string, number>;
  readonly temperature: number;
  readonly blunderRate: number;
  readonly lookaheadDepth: number;
  readonly goOutTuning?: WarpSkillProfile['goOutTuning'];
}

export function serializePresets(
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>
): Record<'beginner' | 'intermediate' | 'advanced', SerializedWarpSkillProfile> {
  return {
    beginner: {
      enabled: [...presets.beginner.enabled],
      weights: { ...presets.beginner.weights },
      temperature: presets.beginner.temperature,
      blunderRate: presets.beginner.blunderRate,
      lookaheadDepth: presets.beginner.lookaheadDepth,
      goOutTuning: presets.beginner.goOutTuning,
    },
    intermediate: {
      enabled: [...presets.intermediate.enabled],
      weights: { ...presets.intermediate.weights },
      temperature: presets.intermediate.temperature,
      blunderRate: presets.intermediate.blunderRate,
      lookaheadDepth: presets.intermediate.lookaheadDepth,
      goOutTuning: presets.intermediate.goOutTuning,
    },
    advanced: {
      enabled: [...presets.advanced.enabled],
      weights: { ...presets.advanced.weights },
      temperature: presets.advanced.temperature,
      blunderRate: presets.advanced.blunderRate,
      lookaheadDepth: presets.advanced.lookaheadDepth,
      goOutTuning: presets.advanced.goOutTuning,
    },
  };
}

export function deserializePresets(
  raw: Record<'beginner' | 'intermediate' | 'advanced', SerializedWarpSkillProfile>
): Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile> {
  const toProfile = (entry: SerializedWarpSkillProfile): WarpSkillProfile => ({
    enabled: new Set(entry.enabled),
    weights: { ...entry.weights },
    temperature: entry.temperature,
    blunderRate: entry.blunderRate,
    lookaheadDepth: entry.lookaheadDepth,
    goOutTuning: entry.goOutTuning ? { ...entry.goOutTuning } : undefined,
  });
  return {
    beginner: toProfile(raw.beginner),
    intermediate: toProfile(raw.intermediate),
    advanced: toProfile(raw.advanced),
  };
}

function runMatchupJobSync(
  job: ParallelMatchupJob,
  options: { games: number; objective: GameObjective; seed: number }
): SkillMatchupResult | { kind: 'focus'; focusWinRate: number; job: ParallelMatchupJob } {
  if (job.kind === 'h2h' && job.left && job.right) {
    return runSkillMatchup(job.left, job.right, options);
  }
  if (job.kind === 'focus' && job.focus && job.opponents) {
    return {
      kind: 'focus',
      job,
      focusWinRate: runFourPlayerFocusMatchup(job.focus, job.opponents, options)
        .focusWinRate,
    };
  }
  throw new Error('Invalid optimizer matchup job');
}

export function workerExecArgv(): string[] {
  const require = createRequire(import.meta.url);
  const jitiRoot = dirname(require.resolve('jiti/package.json'));
  return ['--import', join(jitiRoot, 'lib/jiti-register.mjs')];
}

function runMatchupWorker(
  job: ParallelMatchupJob,
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>,
  options: { games: number; objective: GameObjective; seed: number }
): Promise<
  SkillMatchupResult | { kind: 'focus'; focusWinRate: number; job: ParallelMatchupJob }
> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./optimizer-matchup.worker.ts', import.meta.url), {
      execArgv: workerExecArgv(),
      workerData: {
        job,
        presets: serializePresets(presets),
        options,
      },
    });
    worker.on('message', (message) => resolve(message));
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Optimizer worker exited with code ${code}`));
      }
    });
  });
}

async function runJobsWithPool<T>(
  jobs: readonly ParallelMatchupJob[],
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>,
  options: { games: number; objective: GameObjective; seed: number },
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let nextIndex = 0;

  async function workerLoop(): Promise<void> {
    while (nextIndex < jobs.length) {
      const index = nextIndex++;
      const job = jobs[index]!;
      results[index] = (await runMatchupWorker(job, presets, options)) as T;
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, jobs.length) },
    () => workerLoop()
  );
  await Promise.all(workers);
  return results;
}

export function optimizerParallelism(): number {
  const requested = Number(process.env.AI_OPTIMIZER_WORKERS ?? 0);
  if (requested > 0) {
    return requested;
  }
  return Math.max(1, availableParallelism() - 1);
}

export function shouldParallelizeOptimizer(): boolean {
  return process.env.AI_OPTIMIZER_PARALLEL !== '0';
}

/** Run calibration matchups on multiple cores when AI_OPTIMIZER_PARALLEL is enabled. */
export async function runOptimizerMatchupsParallel(
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>,
  options: { games: number; objective: GameObjective; seed?: number }
): Promise<{
  matrix: SkillMatchupResult[];
  focusAdvancedBeginner: number;
  focusIntermediateBeginner: number;
  focusAdvancedIntermediate: number;
}> {
  const seed = options.seed ?? 9001;
  const runOptions = { games: options.games, objective: options.objective, seed };

  const jobs: ParallelMatchupJob[] = [
    ...SKILL_MATCHUPS.map(([left, right]) => ({
      kind: 'h2h' as const,
      left,
      right,
    })),
    {
      kind: 'focus',
      focus: 'advanced',
      opponents: 'beginner',
    },
    {
      kind: 'focus',
      focus: 'intermediate',
      opponents: 'beginner',
    },
    {
      kind: 'focus',
      focus: 'advanced',
      opponents: 'intermediate',
    },
  ];

  if (!shouldParallelizeOptimizer()) {
    setGoOutPresetsOverride(presets);
    try {
      const syncResults = jobs.map((job) => runMatchupJobSync(job, runOptions));
      return collectParallelResults(syncResults);
    } finally {
      setGoOutPresetsOverride(null);
    }
  }

  const results = await runJobsWithPool<
    SkillMatchupResult | { kind: 'focus'; focusWinRate: number; job: ParallelMatchupJob }
  >(jobs, presets, runOptions, optimizerParallelism());

  return collectParallelResults(results);
}

function collectParallelResults(
  results: readonly (
    | SkillMatchupResult
    | { kind: 'focus'; focusWinRate: number; job: ParallelMatchupJob }
  )[]
): {
  matrix: SkillMatchupResult[];
  focusAdvancedBeginner: number;
  focusIntermediateBeginner: number;
  focusAdvancedIntermediate: number;
} {
  const matrix = results.filter(
    (entry): entry is SkillMatchupResult => !('kind' in entry && entry.kind === 'focus')
  );

  const focusRate = (focus: WarpSkillLevel, opponents: WarpSkillLevel): number => {
    const hit = results.find(
      (entry) =>
        'kind' in entry &&
        entry.kind === 'focus' &&
        entry.job.focus === focus &&
        entry.job.opponents === opponents
    );
    return hit && 'focusWinRate' in hit ? hit.focusWinRate : 0;
  };

  return {
    matrix,
    focusAdvancedBeginner: focusRate('advanced', 'beginner'),
    focusIntermediateBeginner: focusRate('intermediate', 'beginner'),
    focusAdvancedIntermediate: focusRate('advanced', 'intermediate'),
  };
}

/** @internal test helper */
export function __testRunMatchupJobSync(
  job: ParallelMatchupJob,
  presets: Record<'beginner' | 'intermediate' | 'advanced', WarpSkillProfile>,
  options: { games: number; objective: GameObjective; seed: number }
) {
  setGoOutPresetsOverride(presets);
  try {
    return runMatchupJobSync(job, options);
  } finally {
    setGoOutPresetsOverride(null);
  }
}

export { cloneGoOutPresets };
