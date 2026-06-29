import type { HouseRules } from '../types/house-rules.js';
import type { RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';

function hasEstablishedWarpTrail(
  round: RoundState,
  playerId: PlayerId
): boolean {
  return (round.table.warpTrails[playerId]?.tiles.length ?? 0) > 0;
}

/** Every captain has at least one tile on their warp trail. */
export function allCaptainsHaveStartedTrails(round: RoundState): boolean {
  return round.turnOrder.every(
    (captainId) => (round.table.warpTrails[captainId]?.tiles.length ?? 0) > 0
  );
}

export function canChartOnOpponentTrail(
  round: RoundState,
  actingPlayerId: PlayerId,
  trailCaptainId: PlayerId,
  houseRules: HouseRules
): boolean {
  if (trailCaptainId === actingPlayerId) {
    return true;
  }
  if (
    houseRules.requireOwnTrailFirst &&
    !hasEstablishedWarpTrail(round, actingPlayerId)
  ) {
    return false;
  }
  return true;
}

export function canChartOnNeutralZone(
  round: RoundState,
  houseRules: HouseRules
): boolean {
  if (
    houseRules.neutralZoneAfterAllTrails &&
    !allCaptainsHaveStartedTrails(round)
  ) {
    return false;
  }
  return true;
}

export type RoundStarterOpeningObligation =
  | 'none'
  | 'first-own-trail'
  | 'second-own-trail';

/** Whether the round starter still owes Deluxe-style opening charts this turn. */
export function roundStarterOpeningObligation(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules
): RoundStarterOpeningObligation {
  if (!houseRules.roundStarterPlaysTwo) {
    return 'none';
  }
  if (playerId !== round.table.spacedock.placedBy) {
    return 'none';
  }
  if (round.activePlayerId !== playerId) {
    return 'none';
  }

  if (round.roundStarterOpening?.playerId === playerId) {
    return 'second-own-trail';
  }

  const ownTiles = round.table.warpTrails[playerId]?.tiles.length ?? 0;
  if (ownTiles === 0) {
    return 'first-own-trail';
  }
  return 'none';
}

export function mustRestrictToOwnTrailForOpening(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules
): boolean {
  const obligation = roundStarterOpeningObligation(round, playerId, houseRules);
  return obligation === 'first-own-trail' || obligation === 'second-own-trail';
}
