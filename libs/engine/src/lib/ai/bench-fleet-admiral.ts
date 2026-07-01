import type { GameObjective } from '../types/objective.js';
import type { HouseRulesConfig } from '../types/house-rules.js';
import type { PlayerId } from '../types/player.js';
import type { LookaheadOptions } from './lookahead-options.js';
import { createClass1StarPlayer } from './class1-star.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { resolveFleetAdmiralPlayLookahead } from './fleet-admiral.js';
import {
  createTsResidualScorer,
  type Class1StarModelWeights,
  type Class1StarResidualScorer,
} from './residual-scorer.js';
import {
  getWarpSkillProfile,
  resolveWarpLookahead,
} from './skill.js';
import {
  playSelfPlayGame,
  type SelfPlaySeat,
} from './self-play.js';

export interface BenchFleetAdmiralOptions {
  games: number;
  seed?: number;
  objective?: GameObjective;
  playerCount?: number;
  houseRules?: HouseRulesConfig;
  /** Fleet Admiral seat lookahead (default {@link resolveFleetAdmiralPlayLookahead} bench mode). */
  fleetLookahead?: LookaheadOptions;
  /** Seat for Fleet Admiral (default `a`). Use `b` for first-seat symmetry checks. */
  fleetAdmiralSeatId?: PlayerId;
  /** Serializable weights for worker threads (preferred over {@link residualScorer}). */
  class1StarWeights?: Class1StarModelWeights;
  /** Optional Class I* residual on the Fleet Admiral seat (main thread only). */
  residualScorer?: Class1StarResidualScorer;
}

export interface BenchFleetAdmiralResult {
  games: number;
  completed: number;
  fleetAdmiralWins: number;
  commanderWins: number;
  fleetAdmiralWinRate: number | null;
  fleetLookahead: LookaheadOptions;
  usedClass1Star: boolean;
  fleetAdmiralSeatId: PlayerId;
}

/** Build a scorer from JSON weights when running on the main thread. */
export function resolveFleetBenchOptions(
  options: BenchFleetAdmiralOptions
): BenchFleetAdmiralOptions {
  if (options.residualScorer || !options.class1StarWeights) {
    return options;
  }
  return {
    ...options,
    residualScorer: createTsResidualScorer(options.class1StarWeights),
  };
}

function usesClass1Star(options: BenchFleetAdmiralOptions): boolean {
  return (
    options.residualScorer !== undefined || options.class1StarWeights !== undefined
  );
}

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

function makeFleetSeat(
  options: BenchFleetAdmiralOptions,
  fleetLookahead: LookaheadOptions,
  seed: number
): SelfPlaySeat['player'] {
  const objective = options.objective ?? 'points';
  const playerCount = options.playerCount ?? 2;
  const skill = getWarpSkillProfile('commander', objective, playerCount);

  if (options.residualScorer) {
    return createClass1StarPlayer({
      objective,
      playerCount,
      residualScorer: options.residualScorer,
      lookahead: fleetLookahead,
      rng: mulberry32(seed),
    });
  }

  return createWarpAiPlayer({
    skill,
    objective,
    lookahead: fleetLookahead,
    rng: mulberry32(seed),
  });
}

function makeCommanderSeat(
  objective: GameObjective,
  playerCount: number,
  seed: number
): SelfPlaySeat['player'] {
  return createWarpAiPlayer({
    skill: getWarpSkillProfile('commander', objective, playerCount),
    objective,
    lookahead: resolveWarpLookahead('commander', objective, playerCount),
    rng: mulberry32(seed),
  });
}

function buildSeats(
  options: BenchFleetAdmiralOptions,
  fleetLookahead: LookaheadOptions,
  seed: number
): { seats: SelfPlaySeat[]; fleetSeatId: PlayerId } {
  const objective = options.objective ?? 'points';
  const playerCount = options.playerCount ?? 2;
  const fleetSeatId = options.fleetAdmiralSeatId ?? 'a';
  const commanderSeatId: PlayerId = fleetSeatId === 'a' ? 'b' : 'a';

  const seats: SelfPlaySeat[] = [
    {
      id: fleetSeatId,
      displayName: 'Fleet Admiral',
      player: makeFleetSeat(options, fleetLookahead, seed + 997),
    },
    {
      id: commanderSeatId,
      displayName: 'Commander',
      player: makeCommanderSeat(objective, playerCount, seed + 1997),
    },
  ];

  for (let index = 2; index < playerCount; index++) {
    const id = String.fromCharCode(97 + index) as PlayerId;
    seats.push({
      id,
      displayName: `Commander-${id}`,
      player: makeCommanderSeat(objective, playerCount, seed + (index + 1) * 997),
    });
  }

  return { seats, fleetSeatId };
}

function tallyWin(
  winnerId: PlayerId,
  fleetSeatId: PlayerId,
  commanderSeatId: PlayerId
): 'fleet' | 'commander' | 'other' {
  if (winnerId === fleetSeatId) {
    return 'fleet';
  }
  if (winnerId === commanderSeatId) {
    return 'commander';
  }
  return 'other';
}

/** Head-to-head: Fleet Admiral deep search vs Commander. */
export function benchFleetAdmiralVsCommander(
  options: BenchFleetAdmiralOptions
): BenchFleetAdmiralResult {
  const resolved = resolveFleetBenchOptions(options);
  const objective = resolved.objective ?? 'points';
  const playerCount = resolved.playerCount ?? 2;
  const baseSeed = resolved.seed ?? 9001;
  const fleetLookahead =
    resolved.fleetLookahead ??
    resolveFleetAdmiralPlayLookahead(objective, playerCount, 'bench');
  const fleetSeatId = resolved.fleetAdmiralSeatId ?? 'a';
  const commanderSeatId: PlayerId = fleetSeatId === 'a' ? 'b' : 'a';

  let fleetAdmiralWins = 0;
  let commanderWins = 0;
  let completed = 0;

  for (let game = 0; game < resolved.games; game++) {
    const seed = baseSeed + game * 7919;
    const { seats } = buildSeats(resolved, fleetLookahead, seed);

    const result = playSelfPlayGame({
      seats,
      seed,
      objective,
      houseRules: resolved.houseRules,
    });

    if (!result.completed || result.winnerId === null) {
      continue;
    }
    completed++;
    const outcome = tallyWin(result.winnerId, fleetSeatId, commanderSeatId);
    if (outcome === 'fleet') {
      fleetAdmiralWins++;
    } else if (outcome === 'commander') {
      commanderWins++;
    }
  }

  return {
    games: resolved.games,
    completed,
    fleetAdmiralWins,
    commanderWins,
    fleetAdmiralWinRate:
      completed > 0 ? fleetAdmiralWins / completed : null,
    fleetLookahead,
    usedClass1Star: usesClass1Star(resolved),
    fleetAdmiralSeatId: fleetSeatId,
  };
}

export interface BenchGameSlice {
  readonly startGame: number;
  readonly gameCount: number;
}

export interface BenchFleetAdmiralSliceOptions extends BenchFleetAdmiralOptions {
  readonly slice: BenchGameSlice;
}

/** Run a contiguous slice of games (for parallel workers). */
export function benchFleetAdmiralSlice(
  options: BenchFleetAdmiralSliceOptions
): BenchFleetAdmiralResult {
  const resolved = resolveFleetBenchOptions(options);
  const objective = resolved.objective ?? 'points';
  const playerCount = resolved.playerCount ?? 2;
  const baseSeed = resolved.seed ?? 9001;
  const fleetLookahead =
    resolved.fleetLookahead ??
    resolveFleetAdmiralPlayLookahead(objective, playerCount, 'bench');
  const fleetSeatId = resolved.fleetAdmiralSeatId ?? 'a';
  const commanderSeatId: PlayerId = fleetSeatId === 'a' ? 'b' : 'a';

  let fleetAdmiralWins = 0;
  let commanderWins = 0;
  let completed = 0;

  for (let offset = 0; offset < options.slice.gameCount; offset++) {
    const gameIndex = options.slice.startGame + offset;
    const seed = baseSeed + gameIndex * 7919;
    const { seats } = buildSeats(resolved, fleetLookahead, seed);

    const result = playSelfPlayGame({
      seats,
      seed,
      objective,
      houseRules: resolved.houseRules,
    });

    if (!result.completed || result.winnerId === null) {
      continue;
    }
    completed++;
    const outcome = tallyWin(result.winnerId, fleetSeatId, commanderSeatId);
    if (outcome === 'fleet') {
      fleetAdmiralWins++;
    } else if (outcome === 'commander') {
      commanderWins++;
    }
  }

  return {
    games: options.slice.gameCount,
    completed,
    fleetAdmiralWins,
    commanderWins,
    fleetAdmiralWinRate:
      completed > 0 ? fleetAdmiralWins / completed : null,
    fleetLookahead,
    usedClass1Star: usesClass1Star(resolved),
    fleetAdmiralSeatId: fleetSeatId,
  };
}
