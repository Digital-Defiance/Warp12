import {
  coordinateMatchesValue,
  openValueAfterConnection,
  type Coordinate,
  type PlacedCoordinate,
} from '../types/coordinate.js';
import type { ChartRoute, LegalMove } from '../types/actions.js';
import type { RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import {
  isNavigationHaltedByFracture,
  isRedAlertBlocking,
} from '../types/anomalies.js';
import {
  isUncoveredDoubleAtNeutralZoneEnd,
  isUncoveredDoubleAtTrailEnd,
  neutralZoneOpenValue,
  trailOpenValue,
} from '../table/table-state.js';
import { coordinateKey } from '../types/coordinate.js';
import { trailsOpenToOthers } from './q-continuum.js';
import { resolveDeadRedAlert } from './dead-red-alert.js';
import {
  canChartOnNeutralZone,
  canChartOnOpponentTrail,
  mustRestrictToOwnTrailForOpening,
} from './house-rules.js';
import {
  DEFAULT_HOUSE_RULES,
  type HouseRules,
} from '../types/house-rules.js';

function placedTile(
  coordinate: Coordinate,
  index: number,
  connectingValue: number
): PlacedCoordinate | null {
  const openValue = openValueAfterConnection(coordinate, connectingValue);
  if (openValue === null) {
    return null;
  }
  return { coordinate, index, openValue };
}

function canPlayOnTrail(
  round: RoundState,
  playerId: PlayerId,
  actingPlayerId: PlayerId,
  coordinate: Coordinate,
  trailPlayerId: PlayerId,
  forRedAlertCover: boolean,
  houseRules: HouseRules
): boolean {
  const trail = round.table.warpTrails[trailPlayerId];
  if (!trail) {
    return false;
  }

  if (trailPlayerId !== actingPlayerId) {
    if (!trailsOpenToOthers(round, trailPlayerId)) {
      return false;
    }
    if (!canChartOnOpponentTrail(round, actingPlayerId, trailPlayerId, houseRules)) {
      return false;
    }
  }

  const connectingValue = trailOpenValue(trail, round.spacedockValue);

  if (forRedAlertCover) {
    return (
      isUncoveredDoubleAtTrailEnd(trail) &&
      coordinateMatchesValue(coordinate, connectingValue)
    );
  }

  if (
    isUncoveredDoubleAtTrailEnd(trail) &&
    trailPlayerId === actingPlayerId &&
    isRedAlertBlocking(round.table.redAlert, actingPlayerId)
  ) {
    return false;
  }

  return coordinateMatchesValue(coordinate, connectingValue);
}

function canPlayOnNeutralZone(
  round: RoundState,
  coordinate: Coordinate,
  houseRules: HouseRules
): boolean {
  if (!canChartOnNeutralZone(round, houseRules)) {
    return false;
  }
  const connectingValue = neutralZoneOpenValue(
    round.table.neutralZone,
    round.spacedockValue
  );
  return coordinateMatchesValue(coordinate, connectingValue);
}

/**
 * Manual shield control: after charting, helm stays with you for optional shield
 * toggles before you pass. Red Alert cover, fracture stabilizers, round-starter
 * second tile, and mandatory drawn-tile plays are exempt.
 */
export function routineChartsBlockedByManualShieldWindow(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules,
  options?: { fractureActive?: boolean; redAlertBlocking?: boolean }
): boolean {
  if (!houseRules.manualShieldControl || !round.playedThisTurn) {
    return false;
  }
  if (options?.fractureActive || options?.redAlertBlocking) {
    return false;
  }
  if (round.mandatoryPlay?.playerId === playerId) {
    return false;
  }
  if (
    houseRules.roundStarterPlaysTwo &&
    round.roundStarterOpening?.playerId === playerId
  ) {
    return false;
  }
  return true;
}

function canStabilizeFracture(
  round: RoundState,
  coordinate: Coordinate
): boolean {
  const fracture = round.table.subspaceFracture;
  if (!fracture?.active || fracture.stabilizers.length >= 3) {
    return false;
  }
  return coordinateMatchesValue(coordinate, fracture.requiredValue);
}

export function getLegalMoves(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): LegalMove[] {
  round = resolveDeadRedAlert(round);

  if (
    round.qPendingInvoker === playerId ||
    round.qGamblePending?.playerId === playerId
  ) {
    return [];
  }

  const hand = round.hands[playerId] ?? [];
  const mandatory = round.mandatoryPlay;
  const playableHand =
    mandatory?.playerId === playerId
      ? hand.filter(
          (coordinate) =>
            coordinateKey(coordinate) === coordinateKey(mandatory.coordinate)
        )
      : hand;
  const moves: LegalMove[] = [];
  const fractureActive = isNavigationHaltedByFracture(
    round.table.subspaceFracture,
    round.table.redAlert
  );
  const redAlert = round.table.redAlert;

  if (redAlert?.active && redAlert.responsiblePlayerId !== playerId) {
    return [];
  }

  const redAlertBlocking = isRedAlertBlocking(redAlert, playerId);
  const openingOwnTrailOnly = mustRestrictToOwnTrailForOpening(
    round,
    playerId,
    houseRules
  );

  if (
    routineChartsBlockedByManualShieldWindow(round, playerId, houseRules, {
      fractureActive,
      redAlertBlocking,
    })
  ) {
    return [];
  }

  for (const coordinate of playableHand) {
    if (fractureActive) {
      if (canStabilizeFracture(round, coordinate)) {
        moves.push({ coordinate, route: { kind: 'fracture-stabilizer' } });
      }
      continue;
    }

    if (redAlertBlocking) {
      if (redAlert!.neutralZone) {
        const connectingValue = neutralZoneOpenValue(
          round.table.neutralZone,
          round.spacedockValue
        );
        if (
          isUncoveredDoubleAtNeutralZoneEnd(round.table.neutralZone) &&
          coordinateMatchesValue(coordinate, connectingValue)
        ) {
          moves.push({
            coordinate,
            route: { kind: 'red-alert-cover', neutralZone: true },
          });
        }
      } else {
        const trailPlayerId = redAlert!.trailPlayerId;
        if (
          canPlayOnTrail(
            round,
            playerId,
            playerId,
            coordinate,
            trailPlayerId,
            true,
            houseRules
          )
        ) {
          moves.push({
            coordinate,
            route: { kind: 'red-alert-cover', trailPlayerId },
          });
        }
      }
      continue;
    }

    if (canPlayOnTrail(round, playerId, playerId, coordinate, playerId, false, houseRules)) {
      moves.push({
        coordinate,
        route: { kind: 'warp-trail', playerId },
      });
    }

    if (
      !openingOwnTrailOnly &&
      canPlayOnNeutralZone(round, coordinate, houseRules)
    ) {
      moves.push({ coordinate, route: { kind: 'neutral-zone' } });
    }

    if (openingOwnTrailOnly) {
      continue;
    }

    for (const captainId of round.turnOrder) {
      if (captainId === playerId) {
        continue;
      }
      if (
        canPlayOnTrail(
          round,
          playerId,
          playerId,
          coordinate,
          captainId,
          false,
          houseRules
        )
      ) {
        moves.push({
          coordinate,
          route: { kind: 'warp-trail', playerId: captainId },
        });
      }
    }
  }

  return moves;
}

export function isLegalMove(
  round: RoundState,
  playerId: PlayerId,
  coordinate: Coordinate,
  route: ChartRoute,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  return getLegalMoves(round, playerId, houseRules).some(
    (move) =>
      routesEqual(move.route, route) &&
      move.coordinate.low === coordinate.low &&
      move.coordinate.high === coordinate.high
  );
}

function routesEqual(a: ChartRoute, b: ChartRoute): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  switch (a.kind) {
    case 'warp-trail':
      return b.kind === 'warp-trail' && a.playerId === b.playerId;
    case 'neutral-zone':
      return b.kind === 'neutral-zone';
    case 'fracture-stabilizer':
      return b.kind === 'fracture-stabilizer';
    case 'red-alert-cover':
      return (
        b.kind === 'red-alert-cover' &&
        Boolean(a.neutralZone) === Boolean(b.neutralZone) &&
        (a.neutralZone === true ||
          (a.trailPlayerId !== undefined &&
            a.trailPlayerId === b.trailPlayerId))
      );
  }
}

export { placedTile, canStabilizeFracture };
