import type { HouseRules } from '../types/house-rules.js';
import type { RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { advanceActivePlayer } from './q-continuum.js';

/** After charting down to one coordinate, mark declare-or-be-caught pending. */
export function maybeMarkDropToImpulsePending(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules
): RoundState {
  if (!houseRules.dropToImpulseCall) {
    return round;
  }
  const handSize = round.hands[playerId]?.length ?? 0;
  if (handSize !== 1) {
    return round;
  }
  return { ...round, dropToImpulseCallPending: playerId };
}

/** Apply helm pass: forgotten declare becomes catchable; next helm pass closes the window. */
export function advanceTurnWithDropToImpulse(
  round: RoundState,
  houseRules: HouseRules
): RoundState {
  const outgoing = round.activePlayerId;
  let nextRound = advanceActivePlayer({
    ...round,
    roundStarterOpening: null,
  });

  if (!houseRules.dropToImpulseCall) {
    return nextRound;
  }

  if (round.dropToImpulseCallPending === outgoing) {
    return {
      ...nextRound,
      dropToImpulseCallPending: null,
      dropToImpulseCatchable: outgoing,
    };
  }

  if (round.dropToImpulseCatchable != null) {
    return { ...nextRound, dropToImpulseCatchable: null };
  }

  return nextRound;
}

export function applyDropToImpulsePenaltyDraw(
  round: RoundState,
  playerId: PlayerId
): RoundState | null {
  if (round.unchartedSectors.length === 0) {
    return null;
  }
  const [drawn, ...remaining] = round.unchartedSectors;
  return {
    ...round,
    unchartedSectors: remaining,
    dropToImpulseCatchable: null,
    dropToImpulseCallPending: null,
    hands: {
      ...round.hands,
      [playerId]: [...(round.hands[playerId] ?? []), drawn],
    },
  };
}
