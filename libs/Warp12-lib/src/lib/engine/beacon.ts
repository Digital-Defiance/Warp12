import { getLegalMoves } from './legal-moves.js';
import {
  isNavigationHaltedByFracture,
  isRedAlertBlocking,
} from '../types/anomalies.js';
import type { RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';

/** Captain has charted at least one coordinate on their own warp trail. */
export function hasEstablishedWarpTrail(
  round: RoundState,
  playerId: PlayerId
): boolean {
  return (round.table.warpTrails[playerId]?.tiles.length ?? 0) > 0;
}

function resolutionBlockedByQ(round: RoundState, playerId: PlayerId): boolean {
  return (
    round.qPendingInvoker === playerId ||
    round.qGamblePending?.playerId === playerId
  );
}

function mustStabilizeFracture(round: RoundState, playerId: PlayerId): boolean {
  if (!isNavigationHaltedByFracture(round.table.subspaceFracture)) {
    return false;
  }
  return getLegalMoves(round, playerId).some(
    (move) => move.route.kind === 'fracture-stabilizer'
  );
}

/** Must draw from Uncharted Sectors before passing when tiles remain. */
export function mustDrawBeforePassing(
  round: RoundState,
  playerId: PlayerId
): boolean {
  return (
    getLegalMoves(round, playerId).length === 0 &&
    round.unchartedSectors.length > 0
  );
}

/**
 * Deploy the Distress Beacon (shields down).
 *
 * - Forced: no legal chart moves and the draw pile is empty (or red-alert pass).
 * - Strategic: own warp trail is established — may forfeit the turn to open the
 *   trail even when other routes are available.
 */
export function canDeployDistressBeacon(
  round: RoundState,
  playerId: PlayerId,
  options?: { afterDraw?: boolean }
): boolean {
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (round.table.warpTrails[playerId]?.distressBeacon.active === true) {
    return false;
  }
  if (isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (mustStabilizeFracture(round, playerId)) {
    return false;
  }

  const legalMoves = getLegalMoves(round, playerId);
  if (legalMoves.length === 0) {
    if (options?.afterDraw) {
      return true;
    }
    return !mustDrawBeforePassing(round, playerId);
  }

  return hasEstablishedWarpTrail(round, playerId);
}

/**
 * End the turn without charting when shields are already down and no other
 * resolution applies (draw pile empty, no Red Alert pass pending).
 */
export function canPassTurn(
  round: RoundState,
  playerId: PlayerId,
  options?: { afterDraw?: boolean }
): boolean {
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (mustStabilizeFracture(round, playerId)) {
    return false;
  }
  if (getLegalMoves(round, playerId).length > 0) {
    return false;
  }
  if (isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (round.table.warpTrails[playerId]?.distressBeacon.active !== true) {
    return false;
  }
  if (options?.afterDraw) {
    return true;
  }
  return !mustDrawBeforePassing(round, playerId);
}

/** Pass a blocking Red Alert to the next captain (also deploys your beacon). */
export function canPassRedAlert(
  round: RoundState,
  playerId: PlayerId,
  options?: { afterDraw?: boolean }
): boolean {
  if (!isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (mustStabilizeFracture(round, playerId)) {
    return false;
  }
  if (getLegalMoves(round, playerId).length > 0) {
    return false;
  }
  if (options?.afterDraw) {
    return true;
  }
  return !mustDrawBeforePassing(round, playerId);
}

/** Shields rise only by charting on your own warp trail while the beacon is active. */
export function canRaiseShieldsByCharting(
  round: RoundState,
  playerId: PlayerId
): boolean {
  if (round.table.warpTrails[playerId]?.distressBeacon.active !== true) {
    return false;
  }
  return getLegalMoves(round, playerId).some(
    (move) =>
      move.route.kind === 'warp-trail' && move.route.playerId === playerId
  );
}
