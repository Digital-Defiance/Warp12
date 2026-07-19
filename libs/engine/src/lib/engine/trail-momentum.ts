import type { ChartRoute } from '../types/actions.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { sameTrailGroup, trailKeyFor } from './squadrons.js';

/** Personal (or shared-squad) trail tile count. */
export function personalTrailLength(
  round: RoundState,
  playerId: PlayerId
): number {
  const key = trailKeyFor(round, playerId);
  return round.table.warpTrails[key]?.tiles.length ?? 0;
}

/**
 * Module Theta (Go-out) Trail Momentum: first captain whose personal trail
 * reaches length ≥ 5 earns one immediate extra turn, once per round.
 */
export function isTrailMomentumEligible(
  state: Pick<GameState, 'objective' | 'modules' | 'trailMomentumClaimedBy'>
): boolean {
  return (
    state.objective === 'go-out' &&
    state.modules.longestTrail.enabled &&
    state.trailMomentumClaimedBy == null
  );
}

/**
 * Mark a pending extra turn when this chart/spool first crosses length 5 on
 * the captain's personal trail. Caller must also set `trailMomentumClaimedBy`
 * on GameState when the pending flag is newly set.
 */
export function maybeArmTrailMomentum(
  round: RoundState,
  playerId: PlayerId,
  route: ChartRoute,
  lengthBefore: number,
  eligible: boolean
): RoundState {
  if (!eligible || round.trailMomentumExtraTurnFor != null) {
    return round;
  }
  if (
    route.kind !== 'warp-trail' ||
    !sameTrailGroup(round, playerId, route.playerId)
  ) {
    return round;
  }
  const lengthAfter = personalTrailLength(round, playerId);
  if (lengthBefore >= 5 || lengthAfter < 5) {
    return round;
  }
  return { ...round, trailMomentumExtraTurnFor: playerId };
}

/** Consume a pending Trail Momentum reactivation instead of passing the helm. */
export function consumeTrailMomentumExtraTurn(
  round: RoundState
): RoundState | null {
  if (round.trailMomentumExtraTurnFor !== round.activePlayerId) {
    return null;
  }
  return {
    ...round,
    trailMomentumExtraTurnFor: null,
    playedThisTurn: false,
    drewThisTurn: false,
    shieldChangedThisTurn: false,
  };
}
