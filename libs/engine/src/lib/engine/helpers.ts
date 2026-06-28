import type { GameState, RoundState } from '../types/game-state.js';
import type { ActionViolation } from '../types/actions.js';

export function fail(violation: ActionViolation): {
  ok: false;
  violation: ActionViolation;
} {
  return { ok: false, violation };
}

export function requireActiveRound(
  state: GameState
): RoundState | ActionViolation {
  if (state.phase !== 'active' || !state.round) {
    return 'GAME_NOT_ACTIVE';
  }
  if (state.round.phase !== 'playing') {
    return 'ROUND_NOT_PLAYING';
  }
  return state.round;
}

export function requirePlayerTurn(
  round: RoundState,
  playerId: string
): true | ActionViolation {
  if (round.activePlayerId !== playerId) {
    return 'NOT_YOUR_TURN';
  }
  return true;
}

export function nextPlayerId(
  turnOrder: readonly string[],
  currentPlayerId: string
): string {
  const index = turnOrder.indexOf(currentPlayerId);
  return turnOrder[(index + 1) % turnOrder.length];
}

export function withRound(
  state: GameState,
  round: RoundState
): GameState {
  return { ...state, round };
}

export function withRoundAndCaptains(
  state: GameState,
  round: RoundState,
  captains: GameState['captains']
): GameState {
  return { ...state, round, captains };
}
