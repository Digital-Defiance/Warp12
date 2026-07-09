import type { HouseRules } from '../types/house-rules.js';
import type { RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { advanceActivePlayer } from './continuum.js';

/** One tile left after charting — must announce or pass helm (standard knock timing). */
export function isDropToImpulseAnnouncePending(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules
): boolean {
  return (
    houseRules.dropToImpulseCall &&
    round.dropToImpulseCallPending === playerId &&
    (round.hands[playerId]?.length ?? 0) === 1
  );
}
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
  playerId: PlayerId,
  drawCount: 1 | 2 = 1
): RoundState | null {
  if (round.unchartedSectors.length === 0) {
    return null;
  }
  const tilesToDraw = Math.min(drawCount, round.unchartedSectors.length);
  const drawn = round.unchartedSectors.slice(0, tilesToDraw);
  const remaining = round.unchartedSectors.slice(tilesToDraw);
  return {
    ...round,
    unchartedSectors: remaining,
    dropToImpulseCatchable: null,
    dropToImpulseCallPending: null,
    hands: {
      ...round.hands,
      [playerId]: [...(round.hands[playerId] ?? []), ...drawn],
    },
  };
}
