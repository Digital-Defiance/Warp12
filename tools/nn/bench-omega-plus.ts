import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createOmegaPlayer,
  createOmegaSearchPlayer,
  playSelfPlayGame,
  validateOmegaModelWeights,
  type OmegaModelWeights,
  type SelfPlaySeat,
} from '../../libs/engine/src/lib/ai/index.ts';
import type { GameObjective } from '../../libs/engine/src/lib/types/objective.ts';

/**
 * Head-to-head: Class Ω+ (net-guided ISMCTS) vs greedy Ω — SAME weights. Proves
 * the "extended thinking" lift before we wire any UI. Ω+ takes seat `a`; every
 * other seat is greedy Ω. `fairShareRatio` = Ω+ win rate ÷ (1/N): >1 means the
 * search player beats its greedy twin.
 *
 * Env: OMEGA_WEIGHTS, OMEGA_PLUS_GAMES, OMEGA_PLUS_ITERS, OMEGA_PLUS_LEAF,
 *      OMEGA_PLUS_PLAYERS, OMEGA_OBJECTIVE, OMEGA_PLUS_SEED.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const games = Number(process.env.OMEGA_PLUS_GAMES ?? 40);
const iterations = Number(process.env.OMEGA_PLUS_ITERS ?? 256);
const leaf = (process.env.OMEGA_PLUS_LEAF ?? 'puct') as
  | 'puct'
  | 'heuristic'
  | 'value';
const objective = (process.env.OMEGA_OBJECTIVE ?? 'points') as GameObjective;
const baseSeed = Number(process.env.OMEGA_PLUS_SEED ?? 4242);
const weightsPath =
  process.env.OMEGA_WEIGHTS ??
  resolve(repoRoot, 'apps/Warp12/public/models/omega-v1.json');

const playerCounts = (process.env.OMEGA_PLUS_PLAYERS ?? '4')
  .split(',')
  .map((part) => Number(part.trim()))
  .filter((value) => Number.isFinite(value) && value >= 2);

const raw = readFileSync(weightsPath, 'utf8');
const net = JSON.parse(raw) as OmegaModelWeights;
validateOmegaModelWeights(net);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const results = [];
for (const playerCount of playerCounts) {
  const plusSeatId = 'a';
  let plusWins = 0;
  let completed = 0;
  const started = Date.now();

  for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    const seed = baseSeed + gameIndex * 7919;
    const seats: SelfPlaySeat[] = [];
    for (let index = 0; index < playerCount; index++) {
      const id = String.fromCharCode(97 + index);
      seats.push({
        id,
        displayName: id === plusSeatId ? 'Omega+' : `Omega-${id}`,
        player:
          id === plusSeatId
            ? createOmegaSearchPlayer({
                net,
                iterations,
                leaf,
                rng: mulberry32(seed + (index + 1) * 1997),
              })
            : createOmegaPlayer({
                net,
                temperature: 0,
                rng: mulberry32(seed + (index + 1) * 1997),
              }),
      });
    }

    const result = playSelfPlayGame({ seats, seed, objective });
    if (!result.completed || result.winnerId === null) continue;
    completed++;
    if (result.winnerId === plusSeatId) plusWins++;
  }

  const winRate = completed > 0 ? plusWins / completed : null;
  const elapsedMs = Date.now() - started;
  results.push({
    playerCount,
    games,
    completed,
    plusWins,
    plusWinRate: winRate,
    fairShareRatio: winRate !== null ? winRate * playerCount : null,
    msPerGame: completed > 0 ? Math.round(elapsedMs / completed) : null,
  });
}

console.log(
  JSON.stringify(
    { weights: weightsPath, objective, iterations, leaf, results },
    null,
    2
  )
);
