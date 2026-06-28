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
  forRedAlertCover: boolean
): boolean {
  const trail = round.table.warpTrails[trailPlayerId];
  if (!trail) {
    return false;
  }

  if (trailPlayerId !== actingPlayerId) {
    if (!trailsOpenToOthers(round, trailPlayerId)) {
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
  coordinate: Coordinate
): boolean {
  const connectingValue = neutralZoneOpenValue(
    round.table.neutralZone,
    round.spacedockValue
  );
  return coordinateMatchesValue(coordinate, connectingValue);
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
  playerId: PlayerId
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
    round.table.subspaceFracture
  );
  const redAlert = round.table.redAlert;

  if (redAlert?.active && redAlert.responsiblePlayerId !== playerId) {
    return [];
  }

  const redAlertBlocking = isRedAlertBlocking(redAlert, playerId);

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
            true
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

    if (canPlayOnTrail(round, playerId, playerId, coordinate, playerId, false)) {
      moves.push({
        coordinate,
        route: { kind: 'warp-trail', playerId },
      });
    }

    if (canPlayOnNeutralZone(round, coordinate)) {
      moves.push({ coordinate, route: { kind: 'neutral-zone' } });
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
          false
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
  route: ChartRoute
): boolean {
  return getLegalMoves(round, playerId).some(
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
