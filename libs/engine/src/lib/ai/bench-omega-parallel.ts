import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

import {
  benchOmegaVsCommander,
  type BenchOmegaOptions,
  type BenchOmegaResult,
} from './bench-omega.js';
import type { BenchOmegaWorkerPayload } from './bench-omega.worker.js';
import { workerExecArgv } from './worker-bootstrap.js';

export interface BenchOmegaParallelOptions {
  /** Full bench options (net, games, playerCount, …). */
  options: BenchOmegaOptions;
  /** Worker count. Defaults to OMEGA_BENCH_WORKERS, then OMEGA_WORKERS, then cores − 1. */
  workers?: number;
  /** Set false (or OMEGA_BENCH_PARALLEL=0) to force single-threaded bench. */
  parallel?: boolean;
}

function resolveWorkerCount(requested?: number): number {
  if (requested !== undefined && requested > 0) {
    return requested;
  }
  const benchEnv = Number(process.env.OMEGA_BENCH_WORKERS ?? 0);
  if (benchEnv > 0) {
    return benchEnv;
  }
  const env = Number(process.env.OMEGA_WORKERS ?? 0);
  if (env > 0) {
    return env;
  }
  return Math.max(1, availableParallelism() - 1);
}

function shouldParallelize(parallel?: boolean): boolean {
  if (parallel === false) {
    return false;
  }
  return process.env.OMEGA_BENCH_PARALLEL !== '0';
}

function runWorker(payload: BenchOmegaWorkerPayload): Promise<BenchOmegaResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./bench-omega.worker.ts', import.meta.url),
      { execArgv: workerExecArgv(), workerData: payload }
    );
    worker.on('message', (message) => resolve(message as BenchOmegaResult));
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Omega bench worker exited with code ${code}`));
      }
    });
  });
}

function impliedEloFromWinRate(winRate: number): number | null {
  if (winRate <= 0 || winRate >= 1) {
    return null;
  }
  return 400 * Math.log10(winRate / (1 - winRate));
}

export function mergeBenchOmegaResults(
  parts: readonly BenchOmegaResult[]
): BenchOmegaResult {
  if (parts.length === 0) {
    throw new Error('mergeBenchOmegaResults requires at least one result');
  }
  const first = parts[0]!;
  const games = parts.reduce((sum, part) => sum + part.games, 0);
  const completed = parts.reduce((sum, part) => sum + part.completed, 0);
  const omegaWins = parts.reduce((sum, part) => sum + part.omegaWins, 0);
  const omegaWinRate = completed > 0 ? omegaWins / completed : null;

  return {
    games,
    completed,
    objective: first.objective,
    playerCount: first.playerCount,
    omegaSeatId: first.omegaSeatId,
    omegaWins,
    omegaWinRate,
    impliedRatingGap:
      omegaWinRate !== null && first.playerCount === 2
        ? impliedEloFromWinRate(omegaWinRate)
        : null,
    fairShareRatio:
      omegaWinRate !== null ? omegaWinRate * first.playerCount : null,
  };
}

/**
 * Shards bench games across worker threads, then merges win counts. Games are
 * seeded by absolute index so the merged result matches single-threaded bench.
 */
export async function benchOmegaParallel(
  config: BenchOmegaParallelOptions
): Promise<BenchOmegaResult> {
  const { options } = config;
  const totalGames = options.games;
  const workers = resolveWorkerCount(config.workers);

  if (!shouldParallelize(config.parallel) || workers <= 1 || totalGames < workers * 2) {
    return benchOmegaVsCommander(options);
  }

  const sliceSize = Math.ceil(totalGames / workers);
  const payloads: BenchOmegaWorkerPayload[] = [];
  for (let start = 0; start < totalGames; start += sliceSize) {
    const gameCount = Math.min(sliceSize, totalGames - start);
    payloads.push({
      options: {
        ...options,
        slice: { startGameIndex: start, gameCount },
      },
    });
  }

  const parts = await Promise.all(payloads.map((payload) => runWorker(payload)));
  return mergeBenchOmegaResults(parts);
}
