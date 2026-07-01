import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

import {
  type BenchFleetAdmiralOptions,
  type BenchFleetAdmiralResult,
  type BenchFleetAdmiralSliceOptions,
} from './bench-fleet-admiral.js';
import { workerExecArgv } from './worker-bootstrap.js';

/** Payload safe for worker_threads (no function fields). */
export type BenchFleetAdmiralWorkerPayload = Omit<
  BenchFleetAdmiralSliceOptions,
  'residualScorer'
>;

function toWorkerPayload(
  options: BenchFleetAdmiralSliceOptions
): BenchFleetAdmiralWorkerPayload {
  const { residualScorer: _drop, ...payload } = options;
  return payload;
}

function benchParallelism(requested?: number): number {
  if (requested !== undefined && requested > 0) {
    return requested;
  }
  const env = Number(process.env.AI_BENCH_WORKERS ?? 0);
  if (env > 0) {
    return env;
  }
  return Math.max(1, availableParallelism() - 1);
}

function shouldParallelizeBench(parallel?: boolean): boolean {
  if (parallel === false) {
    return false;
  }
  return process.env.AI_BENCH_PARALLEL !== '0';
}

function runBenchWorker(
  options: BenchFleetAdmiralWorkerPayload
): Promise<BenchFleetAdmiralResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./bench-fleet-admiral.worker.ts', import.meta.url),
      {
        execArgv: workerExecArgv(),
        workerData: options,
      }
    );
    worker.on('message', (message) => resolve(message as BenchFleetAdmiralResult));
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Bench worker exited with code ${code}`));
      }
    });
  });
}

function mergeBenchResults(
  games: number,
  fleetLookahead: BenchFleetAdmiralResult['fleetLookahead'],
  usedClass1Star: boolean,
  parts: readonly BenchFleetAdmiralResult[]
): BenchFleetAdmiralResult {
  let completed = 0;
  let fleetAdmiralWins = 0;
  let commanderWins = 0;
  for (const part of parts) {
    completed += part.completed;
    fleetAdmiralWins += part.fleetAdmiralWins;
    commanderWins += part.commanderWins;
  }
  return {
    games,
    completed,
    fleetAdmiralWins,
    commanderWins,
    fleetAdmiralWinRate: completed > 0 ? fleetAdmiralWins / completed : null,
    fleetLookahead,
    usedClass1Star,
    fleetAdmiralSeatId: parts[0]?.fleetAdmiralSeatId ?? 'a',
  };
}

export interface ParallelBenchOptions extends BenchFleetAdmiralOptions {
  workers?: number;
  parallel?: boolean;
}

/** Bench Fleet Admiral vs Commander, optionally sharding games across workers. */
export async function benchFleetAdmiralVsCommanderParallel(
  options: ParallelBenchOptions
): Promise<BenchFleetAdmiralResult> {
  const workers = benchParallelism(options.workers);
  const games = options.games;

  if (!shouldParallelizeBench(options.parallel) || workers <= 1 || games < workers) {
    const { benchFleetAdmiralVsCommander } = await import('./bench-fleet-admiral.js');
    return benchFleetAdmiralVsCommander(options);
  }

  const sliceSize = Math.ceil(games / workers);
  const jobs: BenchFleetAdmiralWorkerPayload[] = [];
  for (let start = 0; start < games; start += sliceSize) {
    jobs.push(
      toWorkerPayload({
        ...options,
        slice: {
          startGame: start,
          gameCount: Math.min(sliceSize, games - start),
        },
      })
    );
  }

  const parts = await Promise.all(jobs.map((job) => runBenchWorker(job)));
  return mergeBenchResults(
    games,
    parts[0]!.fleetLookahead,
    parts[0]!.usedClass1Star,
    parts
  );
}
