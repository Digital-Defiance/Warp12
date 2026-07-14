import type { HouseRules } from '../types/house-rules.js';
import type { RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { sameTrailGroup, trailKeyFor } from './squadrons.js';

function hasEstablishedWarpTrail(
  round: RoundState,
  playerId: PlayerId
): boolean {
  return (
    (round.table.warpTrails[trailKeyFor(round, playerId)]?.tiles.length ?? 0) > 0
  );
}

/**
 * Every captain has at least one tile on their warp trail. Module Zeta: a
 * squad's shared trail counts for every member once any one of them has
 * charted on it — read via trailKeyFor so non-owner squadmates aren't
 * always seen as trail-less (`warpTrails[captainId]` is only populated
 * under the squad's canonical trailKey).
 */
export function allCaptainsHaveStartedTrails(round: RoundState): boolean {
  return round.turnOrder.every(
    (captainId) =>
      (round.table.warpTrails[trailKeyFor(round, captainId)]?.tiles.length ??
        0) > 0
  );
}

export function canChartOnOpponentTrail(
  round: RoundState,
  actingPlayerId: PlayerId,
  trailCaptainId: PlayerId,
  houseRules: HouseRules
): boolean {
  // Module Zeta: trailCaptainId is the trail's canonical key — a squadmate's
  // own (shared) trail must compare via sameTrailGroup, not direct equality.
  if (sameTrailGroup(round, actingPlayerId, trailCaptainId)) {
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
  | 'second-tile-required';

/** Whether the round starter still owes a second tile this turn (not route-restricted). */
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

  // If roundStarterOpening is set, they owe a second tile
  if (round.roundStarterOpening?.playerId === playerId) {
    return 'second-tile-required';
  }

  // On first tile of the round, require second (but don't restrict route).
  // Module Zeta: read the shared squad trail via trailKeyFor.
  const ownTiles =
    round.table.warpTrails[trailKeyFor(round, playerId)]?.tiles.length ?? 0;
  if (ownTiles === 0) {
    return 'second-tile-required';
  }
  return 'none';
}

export function mustRestrictToOwnTrailForOpening(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules
): boolean {
  // Only restrict if both flags are enabled:
  // 1. roundStarterPlaysTwo must be on
  // 2. roundStarterOwnTrailOnly must be on
  if (!houseRules.roundStarterPlaysTwo || !houseRules.roundStarterOwnTrailOnly) {
    return false;
  }

  const obligation = roundStarterOpeningObligation(round, playerId, houseRules);
  return obligation === 'second-tile-required';
}
