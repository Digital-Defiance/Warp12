import { describe, expect, it } from 'vitest';

import {
  __testRunMatchupJobSync,
  cloneGoOutPresets,
  optimizerParallelism,
  shouldParallelizeOptimizer,
  workerExecArgv,
} from './optimizer-parallel.js';

describe('optimizer-parallel', () => {
  it('defaults parallelism to at least one worker slot', () => {
    expect(optimizerParallelism()).toBeGreaterThanOrEqual(1);
  });

  it('parallelizes unless AI_OPTIMIZER_PARALLEL=0', () => {
    const previous = process.env.AI_OPTIMIZER_PARALLEL;
    process.env.AI_OPTIMIZER_PARALLEL = '0';
    expect(shouldParallelizeOptimizer()).toBe(false);
    process.env.AI_OPTIMIZER_PARALLEL = '1';
    expect(shouldParallelizeOptimizer()).toBe(true);
    if (previous === undefined) {
      delete process.env.AI_OPTIMIZER_PARALLEL;
    } else {
      process.env.AI_OPTIMIZER_PARALLEL = previous;
    }
  });

  it('provides jiti register path for worker threads', () => {
    expect(workerExecArgv()[0]).toBe('--import');
    expect(workerExecArgv()[1]).toMatch(/jiti-register\.mjs$/);
  });

  it('runs a tiny heads-up job synchronously for smoke coverage', () => {
    const presets = cloneGoOutPresets();
    const result = __testRunMatchupJobSync(
      { kind: 'h2h', left: 'ensign', right: 'ensign' },
      presets,
      { games: 2, objective: 'go-out', seed: 42 }
    );
    expect(result.left).toBe('ensign');
    expect(result.right).toBe('ensign');
    expect(result.completed).toBe(2);
  });
});
