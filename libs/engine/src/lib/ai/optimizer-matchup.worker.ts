import { parentPort, workerData } from 'node:worker_threads';

import {
  deserializePresets,
  type ParallelMatchupJob,
  type SerializedWarpSkillProfile,
} from './optimizer-parallel.js';
import {
  runFourPlayerFocusMatchup,
  runSkillMatchup,
} from './ai-elo-calibration.js';
import { setGoOutPresetsOverride } from './skill.js';
import type { GameObjective } from '../types/objective.js';

interface WorkerPayload {
  readonly job: ParallelMatchupJob;
  readonly presets: Record<
    'beginner' | 'intermediate' | 'advanced',
    SerializedWarpSkillProfile
  >;
  readonly options: {
    readonly games: number;
    readonly objective: GameObjective;
    readonly seed: number;
  };
}

const payload = workerData as WorkerPayload;
const presets = deserializePresets(payload.presets);
setGoOutPresetsOverride(presets);

try {
  const { job, options } = payload;
  if (job.kind === 'h2h' && job.left && job.right) {
    parentPort?.postMessage(runSkillMatchup(job.left, job.right, options));
  } else if (job.kind === 'focus' && job.focus && job.opponents) {
    parentPort?.postMessage({
      kind: 'focus',
      job,
      focusWinRate: runFourPlayerFocusMatchup(
        job.focus,
        job.opponents,
        options
      ).focusWinRate,
    });
  } else {
    throw new Error('Invalid optimizer worker job');
  }
} finally {
  setGoOutPresetsOverride(null);
}
