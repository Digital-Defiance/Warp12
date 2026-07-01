import { parentPort, workerData } from 'node:worker_threads';

import {
  benchFleetAdmiralSlice,
  resolveFleetBenchOptions,
} from './bench-fleet-admiral.js';
import type { BenchFleetAdmiralWorkerPayload } from './bench-fleet-admiral-parallel.js';

const payload = workerData as BenchFleetAdmiralWorkerPayload;
const result = benchFleetAdmiralSlice({
  ...resolveFleetBenchOptions(payload),
  slice: payload.slice,
});
parentPort?.postMessage(result);
