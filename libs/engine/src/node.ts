/** Node-only bench / calibration APIs — not for browser bundles. */
export {
  benchFleetAdmiralVsCommanderParallel,
  type ParallelBenchOptions,
} from './lib/ai/bench-fleet-admiral-parallel.js';

export {
  benchOmegaParallel,
  mergeBenchOmegaResults,
} from './lib/ai/bench-omega-parallel.js';

export { workerExecArgv } from './lib/ai/worker-bootstrap.js';

export {
  runOptimizerMatchupsParallel,
  optimizerParallelism,
  shouldParallelizeOptimizer,
  type ParallelMatchupJob,
} from './lib/ai/optimizer-parallel.js';
