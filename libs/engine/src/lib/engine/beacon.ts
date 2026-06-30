import { getLegalMoves } from './legal-moves.js';
import {
  isDropToImpulseAnnouncePending,
} from './drop-to-impulse.js';
import {
  isNavigationHaltedByFracture,
  isRedAlertBlocking,
} from '../types/anomalies.js';
import {
  DEFAULT_HOUSE_RULES,
  type HouseRules,
} from '../types/house-rules.js';
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

function mustStabilizeFracture(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  if (!isNavigationHaltedByFracture(round.table.subspaceFracture, round.table.redAlert)) {
    return false;
  }
  return getLegalMoves(round, playerId, houseRules).some(
    (move) => move.route.kind === 'fracture-stabilizer'
  );
}

/** Must draw from Uncharted Sectors before passing when tiles remain. */
export function mustDrawBeforePassing(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  return (
    getLegalMoves(round, playerId, houseRules).length === 0 &&
    round.unchartedSectors.length > 0
  );
}

/**
 * Deploy the Distress Beacon (shields down).
 *
 * Forced only: no legal chart moves and the draw pile is empty (or after
 * drawing on a Red Alert pass). Matches standard Mexican Train — the marker
 * is not deployed voluntarily while other routes are available.
 */
export function canDeployDistressBeacon(
  round: RoundState,
  playerId: PlayerId,
  options?: { afterDraw?: boolean; houseRules?: HouseRules }
): boolean {
  const houseRules = options?.houseRules ?? DEFAULT_HOUSE_RULES;
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (round.table.warpTrails[playerId]?.distressBeacon.active === true) {
    return false;
  }
  if (isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (mustStabilizeFracture(round, playerId, houseRules)) {
    return false;
  }

  const legalMoves = getLegalMoves(round, playerId, houseRules);
  if (legalMoves.length > 0) {
    return false;
  }

  if (options?.afterDraw) {
    return true;
  }
  return !mustDrawBeforePassing(round, playerId, houseRules);
}

/**
 * End the turn without charting when shields are already down and no other
 * resolution applies (draw pile empty, no Red Alert pass pending).
 */
export function canPassTurn(
  round: RoundState,
  playerId: PlayerId,
  options?: { afterDraw?: boolean; houseRules?: HouseRules }
): boolean {
  const houseRules = options?.houseRules ?? DEFAULT_HOUSE_RULES;
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (isDropToImpulseAnnouncePending(round, playerId, houseRules)) {
    if (mustStabilizeFracture(round, playerId, houseRules)) {
      return false;
    }
    if (isRedAlertBlocking(round.table.redAlert, playerId)) {
      return false;
    }
    return true;
  }
  if (mustStabilizeFracture(round, playerId, houseRules)) {
    return false;
  }
  if (getLegalMoves(round, playerId, houseRules).length > 0) {
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
  return !mustDrawBeforePassing(round, playerId, houseRules);
}

/** Pass a blocking Red Alert to the next captain (also deploys your beacon). */
export function canPassRedAlert(
  round: RoundState,
  playerId: PlayerId,
  options?: { afterDraw?: boolean; houseRules?: HouseRules }
): boolean {
  const houseRules = options?.houseRules ?? DEFAULT_HOUSE_RULES;
  if (!isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (mustStabilizeFracture(round, playerId, houseRules)) {
    return false;
  }
  if (getLegalMoves(round, playerId, houseRules).length > 0) {
    return false;
  }
  if (options?.afterDraw) {
    return true;
  }
  return !mustDrawBeforePassing(round, playerId, houseRules);
}

/** Shields rise by charting while the beacon is active (own trail, or any chart with Deluxe house rule). */
export function canRaiseShieldsByCharting(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  if (round.table.warpTrails[playerId]?.distressBeacon.active !== true) {
    return false;
  }
  const legalMoves = getLegalMoves(round, playerId, houseRules);
  if (houseRules.beaconClearsOnAnyPlay) {
    return legalMoves.length > 0;
  }
  return legalMoves.some(
    (move) =>
      move.route.kind === 'warp-trail' && move.route.playerId === playerId
  );
}
