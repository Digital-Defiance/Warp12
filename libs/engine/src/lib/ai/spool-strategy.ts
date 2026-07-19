/**
 * Module Delta: Warp Drive Spool Strategy
 *
 * Heuristics for deciding when to spool vs. chart from hand.
 * Models mismatch risk and unfinished-double abort (retrieve to hand, no RA).
 */

import type { WarpAiObservation } from './observation.js';
import type { PlayerId } from '../types/player.js';
import { sameTrailGroup, trailKeyFor } from '../engine/squadrons.js';

/**
 * Estimate expected value of spooling on a route.
 *
 * Factors:
 * - Hand size (larger hand = less penalty risk)
 * - Uncharted sector size (more tiles = better odds of matches)
 * - Abort risk: matching doubles that cannot be covered return to hand
 *   (no Red Alert / Fracture left) — worse than a simple mismatch in Points
 * - Fracture scope raises abort risk (three stabilizers required)
 * - Trail length competition / Hot Potato / objective
 */
export function estimateSpoolValue(
  obs: WarpAiObservation,
  routePlayerId: PlayerId | null // null = Neutral Zone, PlayerId = warp trail owner
): number {
  const { round, playerId, objective } = obs;
  const hand = round.hands[playerId] ?? [];
  const unchartedSize = round.unchartedSectors.length;

  const handSize = hand.length;
  const isOwnTrail =
    routePlayerId !== null && sameTrailGroup(round, playerId, routePlayerId);
  const isNeutralZone = routePlayerId === null;
  const isOpponentTrail = routePlayerId !== null && !isOwnTrail;

  // FLEET EMBARGO: Never spool on opponent trails (helps them win longest trail)
  if (isOpponentTrail) {
    return -1000;
  }

  // Don't spool if we have a tiny hand in Points campaign (high penalty risk)
  if (objective === 'points' && handSize <= 2) {
    return -150;
  }

  // Don't spool if uncharted is nearly empty (high mismatch / abort risk)
  if (unchartedSize < 4) {
    return -80;
  }

  const ownTrailKey = trailKeyFor(round, playerId);
  const trails = Object.entries(round.table.warpTrails).map(([id, trail]) => ({
    playerId: id,
    length: trail.tiles.length,
  }));

  const ourTrailLength =
    trails.find((t) => t.playerId === ownTrailKey)?.length ?? 0;
  const maxOpponentLength = Math.max(
    ...trails.filter((t) => t.playerId !== ownTrailKey).map((t) => t.length),
    0
  );
  const neutralZoneLength = round.table.neutralZone.tiles.length;

  const totalTilesInPlay =
    trails.reduce((sum, t) => sum + t.length, 0) + neutralZoneLength;
  const earlyGame = totalTilesInPlay < 20;
  const lateGame = totalTilesInPlay >= 50;

  // Base value: more uncharted tiles = better match odds
  let value = unchartedSize * 1.5;

  // === ABORT / MISMATCH RISK ===
  // Mismatch: one tile to hand, spool stops, undrawn stay Uncharted.
  // Abort: matching double cannot be covered / Fracture unfinished → retrieve
  // double (+ failed draws) to hand; no Red Alert / Fracture left. In Points
  // that dumps pips into hand without table progress; in go-out it mainly
  // wastes tempo and grows the race hand.
  const maxPip = obs.maxPip ?? 12;
  const doublesLeft = round.unchartedSectors.filter(
    (c) => c.low === c.high
  ).length;
  const doubleDensity =
    unchartedSize > 0 ? doublesLeft / unchartedSize : 0;
  // Rough P(abort mid-spool) rises with double density and thin covers.
  let abortRisk = doubleDensity * 18;
  if (unchartedSize < 12) {
    abortRisk += 12;
  }
  if (obs.modules.subspaceFracture.enabled) {
    // Fracture needs three matching stabilizers — abort is much more common.
    abortRisk += 22;
    if (obs.modules.subspaceFracture.scope === 'all-doubles') {
      abortRisk += 10;
    }
  }
  if (objective === 'points') {
    // Abort returns heavy doubles to hand — costly vs simple mismatch.
    value -= abortRisk * 1.4;
    value -= Math.min(handSize, 3) * 2; // already-tight hands hate abort
  } else {
    value -= abortRisk * 0.6;
  }

  // === NEUTRAL ZONE STRATEGY ===
  if (isNeutralZone) {
    // Hot Potato: NZ contact *takes* the marker — do not spool NZ while holding it.
    if (obs.modules.warpDriveSpool?.enabled) {
      if (round.hazardMarkerHolder === playerId) {
        value -= 60;
      } else {
        value += 10;
      }
    } else {
      value += 10;
    }

    if (earlyGame) {
      value += 15;
    }

    if (lateGame) {
      value -= 10;
    }

    if (ourTrailLength < maxOpponentLength - 3) {
      value -= 20;
    }

    // Go-out Trail Momentum: NZ spool does not advance personal trail toward 5.
    if (
      objective === 'go-out' &&
      obs.modules.longestTrail.enabled &&
      obs.trailMomentumClaimedBy == null &&
      ourTrailLength < 5
    ) {
      value -= 18;
    }

    return value;
  }

  // === OWN TRAIL STRATEGY ===
  if (isOwnTrail) {
    if (ourTrailLength < maxOpponentLength) {
      const gap = maxOpponentLength - ourTrailLength;
      value += gap * 12;
    }

    if (ourTrailLength > maxOpponentLength + 4) {
      value -= 40;
    }

    if (
      obs.modules.warpDriveSpool?.enabled &&
      round.hazardMarkerHolder === playerId
    ) {
      value += 20;
    }

    if (lateGame && Math.abs(ourTrailLength - maxOpponentLength) <= 2) {
      value += 50;
    }

    // Go-out Trail Momentum: spooling own trail can claim the extra turn.
    if (
      objective === 'go-out' &&
      obs.modules.longestTrail.enabled &&
      obs.trailMomentumClaimedBy == null
    ) {
      if (ourTrailLength >= 3 && ourTrailLength < 5) {
        value += 35;
      } else if (ourTrailLength < 3) {
        value += 12;
      }
    }
  }

  // === OBJECTIVE-SPECIFIC ADJUSTMENTS ===

  if (objective === 'go-out') {
    value += 25;
    // Prefer NZ only when Momentum is already claimed or Theta is off.
    if (
      isNeutralZone &&
      (!obs.modules.longestTrail.enabled ||
        obs.trailMomentumClaimedBy != null ||
        ourTrailLength >= 5)
    ) {
      value += 15;
    }
  }

  if (objective === 'points' && handSize > 7) {
    value += 25;
  }

  if (objective === 'points' && handSize <= 4) {
    value -= 30;
  }

  // === UNCHARTED SIZE ADJUSTMENTS ===

  if (unchartedSize > 30) {
    value += 20;
  }

  if (unchartedSize >= 10 && unchartedSize <= 20) {
    value += 5;
  }

  if (unchartedSize < 10) {
    value -= 30;
  }

  // Mild preference when endpoint pip has many covers still in Uncharted
  // (reduces abort-after-double odds) — unknown without peeking; skip.

  void maxPip;
  return value;
}

/**
 * Should the AI consider spooling at all this turn?
 */
export function shouldConsiderSpool(obs: WarpAiObservation): boolean {
  const { round, playerId, objective } = obs;
  const hand = round.hands[playerId] ?? [];
  const unchartedSize = round.unchartedSectors.length;

  if (!obs.modules.warpDriveSpool?.enabled) {
    return false;
  }

  if (unchartedSize < 3) {
    return false;
  }

  if (objective === 'points' && hand.length <= 2) {
    return false;
  }

  return true;
}

/**
 * Compare spool value to playing a specific tile from hand.
 * Returns positive if spool is better, negative if chart is better.
 */
export function compareSpoolToChart(
  obs: WarpAiObservation,
  spoolRoutePlayerId: PlayerId | null,
  chartTilePipValue: number
): number {
  const spoolValue = estimateSpoolValue(obs, spoolRoutePlayerId);

  const chartValue =
    obs.objective === 'points'
      ? -chartTilePipValue * 2
      : chartTilePipValue * 0.5;

  return spoolValue - chartValue;
}
