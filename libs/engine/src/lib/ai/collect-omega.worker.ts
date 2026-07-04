import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';

import {
  collectOmegaTrajectoriesToSink,
  serializeOmegaTrajectoryRow,
  type CollectOmegaTrajectoriesOptions,
} from './collect-omega-trajectories.js';

export interface CollectOmegaWorkerPayload {
  readonly options: CollectOmegaTrajectoriesOptions;
  readonly shardPath: string;
}

const { options, shardPath } = workerData as CollectOmegaWorkerPayload;

mkdirSync(dirname(shardPath), { recursive: true });
writeFileSync(shardPath, '', 'utf8');

const result = collectOmegaTrajectoriesToSink(options, {
  write(gameRows) {
    if (gameRows.length === 0) return;
    appendFileSync(
      shardPath,
      `${gameRows.map((row) => serializeOmegaTrajectoryRow(row)).join('\n')}\n`,
      'utf8'
    );
  },
});

parentPort?.postMessage(result);
