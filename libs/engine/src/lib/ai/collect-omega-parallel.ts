import {
  appendFileSync,
  createReadStream,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

import {
  collectOmegaTrajectoriesToSink,
  serializeOmegaTrajectoryRow,
  type CollectOmegaTrajectoriesOptions,
  type CollectOmegaTrajectoriesResult,
} from './collect-omega-trajectories.js';
import type { CollectOmegaWorkerPayload } from './collect-omega.worker.js';
import { workerExecArgv } from './worker-bootstrap.js';

export interface CollectOmegaParallelOptions {
  /** Full collection options (net, games, objective, …). */
  options: CollectOmegaTrajectoriesOptions;
  /** Final JSONL output path (shards are concatenated here). */
  outPath: string;
  /** Worker count. Defaults to OMEGA_WORKERS or cores − 1. */
  workers?: number;
  /** Set false (or OMEGA_PARALLEL=0) to force single-threaded collection. */
  parallel?: boolean;
}

function resolveWorkerCount(requested?: number): number {
  if (requested !== undefined && requested > 0) {
    return requested;
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
  return process.env.OMEGA_PARALLEL !== '0';
}

function runWorker(
  payload: CollectOmegaWorkerPayload
): Promise<CollectOmegaTrajectoriesResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./collect-omega.worker.ts', import.meta.url),
      { execArgv: workerExecArgv(), workerData: payload }
    );
    worker.on('message', (message) =>
      resolve(message as CollectOmegaTrajectoriesResult)
    );
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Omega collect worker exited with code ${code}`));
      }
    });
  });
}

function appendShard(outPath: string, shardPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = createReadStream(shardPath);
    source.on('error', reject);
    source.on('data', (chunk) => appendFileSync(outPath, chunk));
    source.on('end', resolve);
  });
}

/**
 * Shards self-play games across worker threads (one shard file each), then
 * concatenates them into `outPath`. Games are seeded by absolute index so the
 * merged dataset is identical regardless of worker count.
 */
export async function collectOmegaParallel(
  config: CollectOmegaParallelOptions
): Promise<CollectOmegaTrajectoriesResult> {
  const { options, outPath } = config;
  const totalGames = options.games;
  const workers = resolveWorkerCount(config.workers);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, '', 'utf8');

  if (!shouldParallelize(config.parallel) || workers <= 1 || totalGames < workers * 2) {
    return collectOmegaTrajectoriesToSink(options, {
      write(rows) {
        if (rows.length === 0) return;
        appendFileSync(
          outPath,
          `${rows.map((row) => serializeOmegaTrajectoryRow(row)).join('\n')}\n`,
          'utf8'
        );
      },
    });
  }

  const sliceSize = Math.ceil(totalGames / workers);
  const shardPaths: string[] = [];
  const payloads: CollectOmegaWorkerPayload[] = [];
  for (let start = 0, shard = 0; start < totalGames; start += sliceSize, shard++) {
    const gameCount = Math.min(sliceSize, totalGames - start);
    const shardPath = `${outPath}.shard${shard}`;
    shardPaths.push(shardPath);
    payloads.push({
      options: {
        ...options,
        slice: { startGameIndex: start, gameCount },
      },
      shardPath,
    });
  }

  const parts = await Promise.all(payloads.map((payload) => runWorker(payload)));

  for (const shardPath of shardPaths) {
    await appendShard(outPath, shardPath);
    rmSync(shardPath, { force: true });
  }

  return parts.reduce<CollectOmegaTrajectoriesResult>(
    (acc, part) => ({
      games: acc.games + part.games,
      completedGames: acc.completedGames + part.completedGames,
      rows: acc.rows + part.rows,
    }),
    { games: 0, completedGames: 0, rows: 0 }
  );
}
