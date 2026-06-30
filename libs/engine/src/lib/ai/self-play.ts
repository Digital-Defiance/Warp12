import { applyAction } from '../engine/apply-action.js';
import { scoreRound } from '../engine/scoring.js';
import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import type { GameState } from '../types/game-state.js';
import type { GameModuleConfig } from '../types/modules.js';
import type { GameObjective } from '../types/objective.js';
import type { PlayerId } from '../types/player.js';
import type { RoundState } from '../types/game-state.js';
import type { WarpAiPlayer } from './create-warp-ai.js';
import { handPips, handTileCount } from './search-model.js';

export interface SelfPlaySeat {
  id: PlayerId;
  displayName?: string;
  player: WarpAiPlayer;
}

export interface PlaySelfPlayGameOptions {
  seats: readonly SelfPlaySeat[];
  seed?: number;
  modules?: GameModuleConfig;
  objective?: GameObjective;
  /** Safety cap so a blocked round can't loop forever (default 20000). */
  maxSteps?: number;
}

export interface SelfPlayGameResult {
  /** Lowest cumulative penalty at completion; null if the game didn't finish. */
  winnerId: PlayerId | null;
  completed: boolean;
  completedRounds: number;
  steps: number;
  penalties: Record<PlayerId, number>;
  finalState: GameState;
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

function totalHandTiles(round: RoundState): number {
  let total = 0;
  for (const id of round.turnOrder) total += (round.hands[id] ?? []).length;
  return total;
}

/** The captain holding the fewest tiles/pips — natural winner of a blocked round. */
export function blockedRoundWinner(round: RoundState, state: GameState): PlayerId {
  let bestId = round.turnOrder[0];
  let bestPrimary = Number.POSITIVE_INFINITY;
  let bestSecondary = Number.POSITIVE_INFINITY;

  for (const id of round.turnOrder) {
    const hand = round.hands[id] ?? [];
    const primary =
      state.objective === 'go-out'
        ? handTileCount(hand)
        : handPips(hand, state.modules, round.roundNumber);
    const secondary = handPips(hand, state.modules, round.roundNumber);
    const better =
      primary < bestPrimary ||
      (primary === bestPrimary &&
        (secondary < bestSecondary ||
          (secondary === bestSecondary && id.localeCompare(bestId) < 0)));
    if (better) {
      bestPrimary = primary;
      bestSecondary = secondary;
      bestId = id;
    }
  }
  return bestId;
}

function roundReadyToScore(
  state: GameState,
  round: RoundState
): RoundState {
  if (
    state.objective === 'go-out' &&
    round.phase === 'ended' &&
    round.roundBlocked &&
    !round.roundWinnerId
  ) {
    return {
      ...round,
      roundWinnerId: blockedRoundWinner(round, state),
    };
  }
  return round;
}

/**
 * Plays one full game between the supplied AI seats, driving the engine
 * directly: act on the active captain, and tally rounds via `scoreRound` when a
 * round ends. Deterministic for a given `seed` (and seeded players).
 */
export function playSelfPlayGame(
  options: PlaySelfPlayGameOptions
): SelfPlayGameResult {
  const seats = options.seats;
  const seed = options.seed ?? 1;
  const captains = seats.map((seat) => ({
    id: seat.id,
    displayName: seat.displayName ?? seat.id,
  }));

  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    mulberry32(seed)
  );

  let state = startGame(
    {
      id: 'self-play',
      captains,
      modules: options.modules,
      objective: options.objective,
    },
    { shuffledCoordinates: shuffled }
  );

  const byId = new Map(seats.map((seat) => [seat.id, seat.player] as const));
  const maxSteps = options.maxSteps ?? 20000;
  // Dedicated stream for round-recycling shuffles so whole games are reproducible.
  const reshuffle = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  let steps = 0;

  // Blocked-round detection: the engine never auto-ends a round where the pile
  // is empty and nobody can play (everyone just keeps deploying beacons). If the
  // total tiles in hand don't change for a full cycle while the pile is empty,
  // we end the round with the lowest-pip captain as the winner (house ruling).
  let stallGuard = 0;
  let lastHandTiles = state.round ? totalHandTiles(state.round) : -1;

  while (state.phase === 'active' && steps < maxSteps) {
    steps++;
    const round = state.round;
    if (!round) break;

    if (round.phase === 'ended') {
      const roundToScore = roundReadyToScore(state, round);
      const result = scoreRound(state, roundToScore, reshuffle);
      if (!result.ok) break;
      state = result.state;
      stallGuard = 0;
      lastHandTiles = state.round ? totalHandTiles(state.round) : -1;
      continue;
    }

    if (round.unchartedSectors.length === 0) {
      const tiles = totalHandTiles(round);
      stallGuard = tiles === lastHandTiles ? stallGuard + 1 : 0;
      lastHandTiles = tiles;
      if (stallGuard >= seats.length * 2) {
        state = {
          ...state,
          round: {
            ...round,
            phase: 'ended',
            roundWinnerId: blockedRoundWinner(round, state),
            allStopDeclared: true,
            allStopRequired: false,
          },
        };
        stallGuard = 0;
        continue;
      }
    } else {
      stallGuard = 0;
      lastHandTiles = totalHandTiles(round);
    }

    const playerId = round.activePlayerId;
    const action = byId.get(playerId)?.decideGameAction(state, playerId);
    if (!action) break;
    const result = applyAction(state, action);
    if (!result.ok) break;
    state = result.state;
  }

  const penalties: Record<PlayerId, number> = {};
  for (const captain of state.captains) {
    penalties[captain.id] = captain.penaltyScore;
  }

  let winnerId: PlayerId | null = null;
  if (state.phase === 'complete') {
    if (state.objective === 'go-out') {
      const round = state.round;
      winnerId =
        round?.roundWinnerId ??
        (round ? blockedRoundWinner(round, state) : null);
    } else {
      let bestPenalty = Number.POSITIVE_INFINITY;
      for (const captain of state.captains) {
        if (captain.penaltyScore < bestPenalty) {
          bestPenalty = captain.penaltyScore;
          winnerId = captain.id;
        }
      }
    }
  }

  return {
    winnerId,
    completed: state.phase === 'complete',
    completedRounds: state.completedRounds,
    steps,
    penalties,
    finalState: state,
  };
}

export interface SelfPlayMatchResult {
  games: number;
  completed: number;
  /** Games each seat id won (completed games only). */
  wins: Record<PlayerId, number>;
  /** Cumulative penalty each seat id accrued across all games (lower = better). */
  penalties: Record<PlayerId, number>;
}

/**
 * Runs a series of games and aggregates wins and accrued penalties per seat id.
 * `makeSeats(gameIndex)` is called per game so callers can rebuild freshly
 * seeded players and/or rotate seating to cancel first-mover advantage.
 */
export function runSelfPlayMatch(
  makeSeats: (gameIndex: number) => readonly SelfPlaySeat[],
  options: {
    games: number;
    seed?: number;
    modules?: GameModuleConfig;
    objective?: GameObjective;
  }
): SelfPlayMatchResult {
  const wins: Record<PlayerId, number> = {};
  const penalties: Record<PlayerId, number> = {};
  let completed = 0;
  const baseSeed = options.seed ?? 1000;

  for (let game = 0; game < options.games; game++) {
    const seats = makeSeats(game);
    const result = playSelfPlayGame({
      seats,
      seed: baseSeed + game * 7919,
      modules: options.modules,
      objective: options.objective,
    });

    if (result.completed) {
      completed++;
      if (result.winnerId !== null) {
        wins[result.winnerId] = (wins[result.winnerId] ?? 0) + 1;
      }
    }
    for (const [id, penalty] of Object.entries(result.penalties)) {
      penalties[id] = (penalties[id] ?? 0) + penalty;
    }
  }

  return { games: options.games, completed, wins, penalties };
}
