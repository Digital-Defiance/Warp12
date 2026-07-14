/**
 * Distress Beacon (shields) gating.
 *
 * Shields down: {@link canDeployDistressBeacon} → DEPLOY_DISTRESS_BEACON.
 * Shields up (standard): chart your own warp trail → auto-clear beacon.
 * Shields up (manual shield control house rule): {@link canRaiseShieldsManually}
 * → RAISE_SHIELDS.
 *
 * Return to warp is not an action — it is the narrative outcome when a captain
 * is caught for a missed Drop to Impulse and draws penalty tiles (see catch flow).
 */
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
import { trailKeyFor } from './squadrons.js';

/** Captain has charted at least one coordinate on their own (squad) warp trail. */
export function hasEstablishedWarpTrail(
  round: RoundState,
  playerId: PlayerId
): boolean {
  return (
    (round.table.warpTrails[trailKeyFor(round, playerId)]?.tiles.length ?? 0) > 0
  );
}

function resolutionBlockedByQ(round: RoundState, playerId: PlayerId): boolean {
  return (
    round.continuumPendingInvoker === playerId ||
    round.continuumWagerPending?.playerId === playerId
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

/** Draw from Uncharted Sectors when unable to chart (standard Mexican Train draw). */
export function canDrawFromUncharted(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (round.drewThisTurn) {
    return false;
  }
  // Manual shield control: once you have charted this turn your play is done —
  // you never draw afterward (the empty legal-move list is only because a second
  // routine chart is blocked, not because you are genuinely stuck).
  if (round.playedThisTurn) {
    return false;
  }
  if (round.unchartedSectors.length === 0) {
    return false;
  }
  return getLegalMoves(round, playerId, houseRules).length === 0;
}

/** Must draw from Uncharted Sectors before passing when tiles remain. */
export function mustDrawBeforePassing(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  return (
    getLegalMoves(round, playerId, houseRules).length === 0 &&
    round.unchartedSectors.length > 0 &&
    !round.drewThisTurn
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
  if (
    round.table.warpTrails[trailKeyFor(round, playerId)]?.distressBeacon.active ===
    true
  ) {
    return false;
  }
  if (isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (mustStabilizeFracture(round, playerId, houseRules)) {
    return false;
  }

  const legalMoves = getLegalMoves(round, playerId, houseRules);
  // Manual shield control: you may voluntarily open your own trail at any time,
  // for any reason (even with legal plays, even before starting your trail) —
  // but only once per turn. If you have already changed shields this turn, fall
  // through to the standard forced-marker logic below.
  if (houseRules.manualShieldControl && round.shieldChangedThisTurn !== true) {
    return true;
  }
  if (legalMoves.length > 0) {
    return false;
  }

  if (options?.afterDraw) {
    // Standard Mexican Train: you draw one tile when stuck; if it still cannot
    // be charted, your marker goes down (shields down) and your turn ends —
    // regardless of how many tiles remain in Uncharted Sectors.
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
  if (houseRules.manualShieldControl && round.playedThisTurn) {
    // You have already charted this turn: you may pass to end it (after any
    // optional shield toggle). No draw is owed — you made your play.
    if (isRedAlertBlocking(round.table.redAlert, playerId)) {
      return false;
    }
    return true;
  }
  if (getLegalMoves(round, playerId, houseRules).length > 0) {
    return false;
  }
  if (isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (
    round.table.warpTrails[trailKeyFor(round, playerId)]?.distressBeacon.active !==
    true
  ) {
    return false;
  }
  if (options?.afterDraw) {
    return true;
  }
  return !mustDrawBeforePassing(round, playerId, houseRules);
}

/** Pass a blocking Red Alert to the next captain (deploys your beacon unless house rule). */
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
  // The free pass only applies to the captain who charted the double, and only
  // while the alert is still in Yellow alert (not yet passed to anyone).
  // Once responsibility has moved on, everyone — including the original
  // captain when it cycles back — must draw before passing as usual.
  if (
    houseRules.passRedAlertWithoutDraw &&
    round.table.redAlert?.passed !== true
  ) {
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
  if (houseRules.manualShieldControl) {
    return false;
  }
  const trailKey = trailKeyFor(round, playerId);
  if (round.table.warpTrails[trailKey]?.distressBeacon.active !== true) {
    return false;
  }
  const legalMoves = getLegalMoves(round, playerId, houseRules);
  if (houseRules.beaconClearsOnAnyPlay) {
    return legalMoves.length > 0;
  }
  return legalMoves.some(
    (move) =>
      move.route.kind === 'warp-trail' && move.route.playerId === trailKey
  );
}

/**
 * Explicitly raise shields (manual shield control house rule).
 *
 * You may close your own trail only once you have charted on your own trail
 * *since* the beacon was dropped (tracked by `chartedOwnTrailSinceDown`), and
 * at most once per turn. Each time you re-open, that permission resets until you
 * next service your own trail.
 */
export function canRaiseShieldsManually(
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  if (!houseRules.manualShieldControl) {
    return false;
  }
  if (round.shieldChangedThisTurn === true) {
    return false;
  }
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  const beacon =
    round.table.warpTrails[trailKeyFor(round, playerId)]?.distressBeacon;
  if (beacon?.active !== true) {
    return false;
  }
  if (beacon.chartedOwnTrailSinceDown !== true) {
    return false;
  }
  if (isRedAlertBlocking(round.table.redAlert, playerId)) {
    return false;
  }
  if (mustStabilizeFracture(round, playerId, houseRules)) {
    return false;
  }
  return true;
}

/** Module Gamma: Sensor sweep from the visible market (alternative to blind draw). */
export function canSensorSweep(
  modules: import('../types/modules.js').GameModules,
  round: RoundState,
  playerId: PlayerId,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  if (!modules.sensorGrid.enabled) {
    return false;
  }
  if (resolutionBlockedByQ(round, playerId)) {
    return false;
  }
  if (round.drewThisTurn) {
    return false;
  }
  if (round.playedThisTurn) {
    return false;
  }
  if (round.sensorGrid.length === 0) {
    return false;
  }
  return getLegalMoves(round, playerId, houseRules).length === 0;
}
