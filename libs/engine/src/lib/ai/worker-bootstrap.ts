import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** execArgv for worker_threads that load TypeScript via jiti (CLI/bench only). */
export function workerExecArgv(): string[] {
  const require = createRequire(import.meta.url);
  const jitiRoot = dirname(require.resolve('jiti/package.json'));
  return ['--import', join(jitiRoot, 'lib/jiti-register.mjs')];
}
