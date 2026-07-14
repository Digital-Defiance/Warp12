/**
 * Module Delta: Warp Drive Spool Strategy
 * 
 * Heuristics for deciding when to spool vs. chart from hand.
 */

import type { WarpAiObservation } from './observation.js';
import type { PlayerId } from '../types/player.js';
import { sameTrailGroup, trailKeyFor } from '../engine/squadrons.js';

/**
 * Estimate expected value of spooling on a route.
 * 
 * Factors:
 * - Hand size (larger hand = less penalty risk)
 * - Uncharted sector size (more tiles = better odds)
 * - Trail length competition (how close is longest trail race)
 * - Objective (Points vs Go-out)
 * - Route type (own trail vs Neutral Zone)
 * - Game phase (early vs late)
 */
export function estimateSpoolValue(
  obs: WarpAiObservation,
  routePlayerId: PlayerId | null // null = Neutral Zone, PlayerId = warp trail owner
): number {
  const { round, playerId, objective } = obs;
  const hand = round.hands[playerId] ?? [];
  const unchartedSize = round.unchartedSectors.length;
  
  // Base factors
  const handSize = hand.length;
  const isOwnTrail =
    routePlayerId !== null && sameTrailGroup(round, playerId, routePlayerId);
  const isNeutralZone = routePlayerId === null;
  const isOpponentTrail = routePlayerId !== null && !isOwnTrail;
  
  // FLEET EMBARGO: Never spool on opponent trails (helps them win longest trail)
  if (isOpponentTrail) {
    return -1000; // Extremely negative
  }
  
  // Don't spool if we have a tiny hand in Points campaign (high penalty risk)
  if (objective === 'points' && handSize <= 2) {
    return -150;
  }
  
  // Don't spool if uncharted is nearly empty (high mismatch risk)
  if (unchartedSize < 4) {
    return -80;
  }
  
  // Calculate current trail lengths for competition assessment (own = squad
  // trail key; opponent trails already de-duped since they're keyed by squad).
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
  
  // Game phase detection
  const totalTilesInPlay = trails.reduce((sum, t) => sum + t.length, 0) + neutralZoneLength;
  const earlyGame = totalTilesInPlay < 20;
  const lateGame = totalTilesInPlay >= 50;
  
  // Base value: more uncharted tiles = better odds
  let value = unchartedSize * 1.5;
  
  // === NEUTRAL ZONE STRATEGY ===
  if (isNeutralZone) {
    // If we hold hazard marker, NZ spool is GREAT (clears the hazard!)
    if (round.hazardMarkerHolder === playerId) {
      value += 60; // Strong incentive - clears +2 penalty
    }
    
    // If we don't hold hazard, NZ is moderate
    if (!round.hazardMarkerHolder || round.hazardMarkerHolder !== playerId) {
      value += 10; // Decent option
    }
    
    // Game phase adjustments
    if (earlyGame) {
      value += 15; // Less pressure
    }
    
    if (lateGame) {
      value -= 10; // More risk with small uncharted
    }
    
    // NZ doesn't help longest trail bonus
    if (ourTrailLength < maxOpponentLength - 3) {
      value -= 20; // Moderate preference for own trail when significantly behind
    }
    
    return value;
  }
  
  // === OWN TRAIL STRATEGY ===
  if (isOwnTrail) {
    // Bonus for being behind in trail length (need to catch up)
    if (ourTrailLength < maxOpponentLength) {
      const gap = maxOpponentLength - ourTrailLength;
      value += gap * 12; // Strong incentive to catch up
    }
    
    // Penalty if we're already winning trail length by a lot (don't need the risk)
    if (ourTrailLength > maxOpponentLength + 4) {
      value -= 40; // Already winning, preserve lead
    }
    
    // If we hold hazard marker, own trail is okay but NZ is better for clearing
    if (round.hazardMarkerHolder === playerId) {
      value -= 10; // Slight penalty - NZ clears hazard, own trail doesn't
    }
    
    // Late game with close trail race: Spool is critical for bonus
    if (lateGame && Math.abs(ourTrailLength - maxOpponentLength) <= 2) {
      value += 50; // High stakes - need every tile for tie-break
    }
  }
  
  // === OBJECTIVE-SPECIFIC ADJUSTMENTS ===
  
  // Go-out objective: Spooling doesn't deplete hand, which is excellent
  if (objective === 'go-out') {
    value += 25;
    // NZ preferred in go-out (no hand depletion, no hazard penalty matters)
    if (isNeutralZone) {
      value += 15;
    }
  }
  
  // Points objective with large hand: Spooling is more attractive
  if (objective === 'points' && handSize > 7) {
    value += 25; // More tiles in hand = more comfortable with mismatch risk
  }
  
  // Points objective with small hand: Very risky
  if (objective === 'points' && handSize <= 4) {
    value -= 30;
  }
  
  // === UNCHARTED SIZE ADJUSTMENTS ===
  
  // Very large uncharted: Low mismatch risk
  if (unchartedSize > 30) {
    value += 20;
  }
  
  // Medium uncharted: Moderate risk
  if (unchartedSize >= 10 && unchartedSize <= 20) {
    value += 5;
  }
  
  // Small uncharted: High risk
  if (unchartedSize < 10) {
    value -= 30;
  }
  
  return value;
}

/**
 * Should the AI consider spooling at all this turn?
 * 
 * Quick gate to avoid expensive evaluation when spooling is obviously bad.
 */
export function shouldConsiderSpool(obs: WarpAiObservation): boolean {
  const { round, playerId, objective } = obs;
  const hand = round.hands[playerId] ?? [];
  const unchartedSize = round.unchartedSectors.length;
  
  // Module not enabled
  if (!obs.modules.warpDriveSpool?.enabled) {
    return false;
  }
  
  // Too few tiles in uncharted (high mismatch risk)
  if (unchartedSize < 3) {
    return false;
  }
  
  // Points campaign with very small hand (too risky)
  if (objective === 'points' && hand.length <= 2) {
    return false;
  }
  
  // Otherwise, worth considering
  return true;
}

/**
 * Compare spool value to playing a specific tile from hand.
 * 
 * Returns positive if spool is better, negative if chart is better.
 */
export function compareSpoolToChart(
  obs: WarpAiObservation,
  spoolRoutePlayerId: PlayerId | null, // null = Neutral Zone
  chartTilePipValue: number
): number {
  const spoolValue = estimateSpoolValue(obs, spoolRoutePlayerId);
  
  // Chart value heuristic: lower pip value = better in Points campaign
  const chartValue = obs.objective === 'points' 
    ? -chartTilePipValue * 2 // Negative because lower is better; doubled to compete with spool
    : chartTilePipValue * 0.5; // Go-out: slightly prefer playing tiles to reduce hand
  
  return spoolValue - chartValue;
}
