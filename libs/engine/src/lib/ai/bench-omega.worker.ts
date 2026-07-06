import { parentPort, workerData } from 'node:worker_threads';

import {
  benchOmegaVsCommander,
  type BenchOmegaOptions,
  type BenchOmegaResult,
} from './bench-omega.js';

export interface BenchOmegaWorkerPayload {
  readonly options: BenchOmegaOptions;
}

const { options } = workerData as BenchOmegaWorkerPayload;

const result: BenchOmegaResult = benchOmegaVsCommander(options);

parentPort?.postMessage(result);
