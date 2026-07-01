import { coordinateKey, type Coordinate } from '../types/coordinate.js';
import type { GameState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { getLegalMoves } from '../engine/legal-moves.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';

/** Max rejection samples when belief-constrained hand assignment fails. */
export const BELIEF_ASSIGN_MAX_ATTEMPTS = 48;

function hasLegalChartMove(state: GameState, playerId: PlayerId): boolean {
  const round = state.round;
  if (!round || round.phase !== 'playing') {
    return false;
  }
  const probe = { ...round, activePlayerId: playerId };
  const moves = getLegalMoves(
    probe,
    playerId,
    state.houseRules ?? DEFAULT_HOUSE_RULES
  );
  return moves.length > 0;
}

/**
 * Validates a determinized hand assignment against observable constraints:
 * mandatory-play pins, empty-pile blocked-round consistency.
 */
export function passesBeliefConstraints(
  state: GameState,
  hands: Readonly<Record<PlayerId, readonly Coordinate[]>>
): boolean {
  const round = state.round;
  if (!round) {
    return true;
  }

  if (round.mandatoryPlay) {
    const { playerId, coordinate } = round.mandatoryPlay;
    const hand = hands[playerId] ?? [];
    const pinned = hand.some(
      (tile) => coordinateKey(tile) === coordinateKey(coordinate)
    );
    if (!pinned) {
      return false;
    }
  }

  if (round.unchartedSectors.length === 0 && round.phase === 'playing') {
    const stateWithHands: GameState = {
      ...state,
      round: { ...round, hands: { ...hands } as Record<PlayerId, Coordinate[]> },
    };
    let canPlayCount = 0;
    for (const id of round.turnOrder) {
      if (hasLegalChartMove(stateWithHands, id)) {
        canPlayCount++;
      }
    }
    if (canPlayCount === round.turnOrder.length && round.turnOrder.length > 1) {
      return false;
    }
  }

  return true;
}

/**
 * Assign hidden hands from the unseen pool with optional belief rejection sampling.
 */
export function assignHiddenHands(
  state: GameState,
  perspective: PlayerId,
  pool: readonly Coordinate[],
  rng: () => number,
  useBeliefConstraints: boolean
): Record<PlayerId, Coordinate[]> | null {
  const round = state.round;
  if (!round) {
    return null;
  }

  const myHand = round.hands[perspective] ?? [];
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1));
    const tmp = shuffled[index];
    shuffled[index] = shuffled[swap]!;
    shuffled[swap] = tmp!;
  }

  const deal = (enforceBelief: boolean): Record<PlayerId, Coordinate[]> | null => {
    const hands: Record<PlayerId, Coordinate[]> = {};
    let cursor = 0;
    for (const id of round.turnOrder) {
      if (id === perspective) {
        hands[id] = [...myHand];
        continue;
      }
      const count = (round.hands[id] ?? []).length;
      if (cursor + count > shuffled.length) {
        return null;
      }
      hands[id] = shuffled.slice(cursor, cursor + count);
      cursor += count;
    }
    if (!enforceBelief || passesBeliefConstraints(state, hands)) {
      return hands;
    }
    return null;
  };

  if (!useBeliefConstraints) {
    return deal(false);
  }

  for (let attempt = 0; attempt < BELIEF_ASSIGN_MAX_ATTEMPTS; attempt++) {
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(rng() * (index + 1));
      const tmp = shuffled[index];
      shuffled[index] = shuffled[swap]!;
      shuffled[swap] = tmp!;
    }
    const hands = deal(true);
    if (hands) {
      return hands;
    }
  }

  return deal(false);
}
