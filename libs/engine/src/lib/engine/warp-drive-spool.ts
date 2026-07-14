import type { Coordinate } from '../types/coordinate.js';
import type { PlayerId } from '../types/player.js';
import type { RoundState } from '../types/game-state.js';
import type { ChartRoute } from '../types/actions.js';
import type { GameModules } from '../types/modules.js';
import { isDouble } from '../types/coordinate.js';
import { subspaceFractureAppliesToDouble } from '../types/modules.js';
import { routeIsOwnTrail } from './squadrons.js';
import { MAX_SPOOL_TILES } from '../constants/setup.js';

/**
 * Module Delta: Warp Drive Spooling
 * 
 * Draw from Uncharted Sectors continuously (up to MAX_SPOOL_TILES), auto-playing matches until:
 * - Mismatch occurs (goes to hand, spool ends)
 * - Red Alert cannot be covered (double stays, mismatch to hand, spool ends)
 * - Subspace Fracture cannot be satisfied (double stays, all attempts to hand, spool ends)
 * - Tile limit reached (spool ends successfully)
 */

export interface SpoolResult {
  readonly success: boolean;
  readonly tilesPlayed: readonly Coordinate[];
  readonly tilesSentToHand: readonly Coordinate[];
  readonly finalEndpoint: number | null;
  readonly redAlertActive: boolean;
  readonly fractureActive: boolean;
  readonly fractureStabilizersPlaced: number;
  readonly unchartedRemaining: readonly Coordinate[];
  /** True if this spool qualifies to clear hazard marker (2+ tiles on own trail). */
  readonly clearsHazardMarker: boolean;
  readonly debugInfo?: string;
}

/**
 * Check if coordinate matches an endpoint pip value.
 */
function coordinateMatches(coordinate: Coordinate, endpoint: number): boolean {
  return coordinate.low === endpoint || coordinate.high === endpoint;
}

/**
 * Get the opposite end of a coordinate given which end was played.
 */
function getOppositeEnd(coordinate: Coordinate, playedEnd: number): number {
  if (coordinate.low === playedEnd) {
    return coordinate.high;
  }
  if (coordinate.high === playedEnd) {
    return coordinate.low;
  }
  throw new Error(`Coordinate ${coordinate.low}-${coordinate.high} does not contain ${playedEnd}`);
}

/**
 * Execute a warp drive spool: draw from uncharted until mismatch.
 * 
 * NEW: If spooling on own trail and 2+ tiles are successfully played,
 * the hazard marker clears (returned in clearsHazardMarker flag).
 */
export function executeWarpDriveSpool(
  startEndpoint: number,
  unchartedSectors: readonly Coordinate[],
  modules: GameModules,
  route: ChartRoute,
  playerId: PlayerId,
  round: RoundState
): SpoolResult {
  const played: Coordinate[] = [];
  const sentToHand: Coordinate[] = [];
  let remaining = [...unchartedSectors];
  let currentEndpoint = startEndpoint;
  let redAlertActive = false;
  let fractureActive = false;
  let fractureStabilizersPlaced = 0;

  while (remaining.length > 0 && played.length < MAX_SPOOL_TILES) {
    const [drawn, ...rest] = remaining;
    remaining = rest;

    // Check if drawn tile matches current endpoint
    if (!coordinateMatches(drawn, currentEndpoint)) {
      // MISMATCH - goes to hand, spool ends
      sentToHand.push(drawn);
      
      // Determine if hazard clears: own trail + 2+ tiles played
      const isOwnTrail = routeIsOwnTrail(round, playerId, route);
      const clearsHazard = isOwnTrail && played.length >= 2;
      
      return {
        success: false,
        tilesPlayed: played,
        tilesSentToHand: sentToHand,
        finalEndpoint: currentEndpoint,
        redAlertActive,
        fractureActive,
        fractureStabilizersPlaced,
        unchartedRemaining: remaining,
        clearsHazardMarker: clearsHazard,
      };
    }

    // Tile matches - play it
    played.push(drawn);
    currentEndpoint = getOppositeEnd(drawn, currentEndpoint);

    // Check if it's a double
    if (isDouble(drawn)) {
      // Check if Subspace Fracture applies
      const needsFracture = 
        modules.subspaceFracture.enabled &&
        subspaceFractureAppliesToDouble(route, playerId, modules.subspaceFracture.scope, round);

      if (needsFracture) {
        // Need 3 stabilizers
        fractureActive = true;
        redAlertActive = true;
        fractureStabilizersPlaced = 0;

        for (let i = 0; i < 3; i++) {
          if (remaining.length === 0) {
            // Out of tiles during fracture - fail
            const isOwnTrail = routeIsOwnTrail(round, playerId, route);
            const clearsHazard = isOwnTrail && played.length >= 2;
            
            return {
              success: false,
              tilesPlayed: played,
              tilesSentToHand: sentToHand,
              finalEndpoint: null, // Fracture incomplete
              redAlertActive: true,
              fractureActive: true,
              fractureStabilizersPlaced,
              unchartedRemaining: remaining,
              clearsHazardMarker: clearsHazard,
            };
          }

          const [stabilizer, ...afterStabilizer] = remaining;
          
          if (!coordinateMatches(stabilizer, drawn.low)) {
            // Stabilizer doesn't match - all 3 attempts go to hand
            // We need to collect all attempted stabilizers
            const failedStabilizers = [stabilizer];
            let tempRemaining = afterStabilizer;
            
            // Try to get the rest (already drawn conceptually)
            for (let j = i + 1; j < 3 && tempRemaining.length > 0; j++) {
              const [nextAttempt, ...afterNext] = tempRemaining;
              failedStabilizers.push(nextAttempt);
              tempRemaining = afterNext;
            }

            sentToHand.push(...failedStabilizers);
            
            const isOwnTrail = routeIsOwnTrail(round, playerId, route);
            const clearsHazard = isOwnTrail && played.length >= 2;
            
            return {
              success: false,
              tilesPlayed: played,
              tilesSentToHand: sentToHand,
              finalEndpoint: null, // Fracture incomplete
              redAlertActive: true,
              fractureActive: true,
              fractureStabilizersPlaced,
              unchartedRemaining: tempRemaining,
              clearsHazardMarker: clearsHazard,
            };
          }

          // Stabilizer matches
          played.push(stabilizer);
          remaining = afterStabilizer;
          fractureStabilizersPlaced++;

          // After 3rd stabilizer, update endpoint to center foot
          if (i === 2) {
            currentEndpoint = getOppositeEnd(stabilizer, drawn.low);
          }
        }

        // Fracture satisfied
        fractureActive = false;
        redAlertActive = false;
        fractureStabilizersPlaced = 0;

      } else {
        // Standard Red Alert - need cover tile
        redAlertActive = true;

        if (remaining.length === 0) {
          // No tiles left to cover - spool ends with active Red Alert
          const isOwnTrail = routeIsOwnTrail(round, playerId, route);
          const clearsHazard = isOwnTrail && played.length >= 2;
          
          return {
            success: false,
            tilesPlayed: played,
            tilesSentToHand: sentToHand,
            finalEndpoint: null, // Double uncovered
            redAlertActive: true,
            fractureActive: false,
            fractureStabilizersPlaced: 0,
            unchartedRemaining: remaining,
            clearsHazardMarker: clearsHazard,
          };
        }

        const [cover, ...afterCover] = remaining;

        if (!coordinateMatches(cover, drawn.low)) {
          // Cover doesn't match - goes to hand, spool ends with Red Alert
          sentToHand.push(cover);
          remaining = afterCover;

          const isOwnTrail = routeIsOwnTrail(round, playerId, route);
          const clearsHazard = isOwnTrail && played.length >= 2;

          return {
            success: false,
            tilesPlayed: played,
            tilesSentToHand: sentToHand,
            finalEndpoint: null, // Double uncovered
            redAlertActive: true,
            fractureActive: false,
            fractureStabilizersPlaced: 0,
            unchartedRemaining: remaining,
            clearsHazardMarker: clearsHazard,
          };
        }

        // Cover matches - play it and continue
        played.push(cover);
        remaining = afterCover;
        currentEndpoint = getOppositeEnd(cover, drawn.low);
        redAlertActive = false;
      }
    }
  }

  // Ran out of tiles - spool ends successfully
  const isOwnTrail = routeIsOwnTrail(round, playerId, route);
  const clearsHazard = isOwnTrail && played.length >= 2;
  
  return {
    success: true,
    tilesPlayed: played,
    tilesSentToHand: sentToHand,
    finalEndpoint: currentEndpoint,
    redAlertActive,
    fractureActive,
    fractureStabilizersPlaced,
    unchartedRemaining: remaining,
    clearsHazardMarker: clearsHazard,
  };
}

/**
 * Calculate trail length for longest trail bonus.
 */
export function calculateTrailLength(trail: readonly { coordinate: Coordinate }[]): number {
  return trail.length;
}

/**
 * Determine longest trail winner. Returns playerId or null for tie.
 * Neutral Zone is excluded from trail lengths.
 */
export function determineLongestTrailWinner(
  trails: Readonly<Record<PlayerId, readonly { coordinate: Coordinate }[]>>,
  hazardMarkerHolder: PlayerId | null
): { winner: PlayerId | null; length: number; tied: readonly PlayerId[] } {
  const lengths = Object.entries(trails).map(([playerId, trail]) => ({
    playerId,
    length: calculateTrailLength(trail),
  }));

  if (lengths.length === 0) {
    return { winner: null, length: 0, tied: [] };
  }

  const maxLength = Math.max(...lengths.map((l) => l.length));
  const winners = lengths.filter((l) => l.length === maxLength);

  if (winners.length === 1) {
    return { winner: winners[0].playerId, length: maxLength, tied: [] };
  }

  // Multiple tied - check hazard marker
  const tiedIds = winners.map((w) => w.playerId);
  const hazardHolderInTie = hazardMarkerHolder && tiedIds.includes(hazardMarkerHolder);

  if (hazardHolderInTie) {
    // Hazard holder loses tie
    const nonHazardWinners = tiedIds.filter((id) => id !== hazardMarkerHolder);
    if (nonHazardWinners.length === 1) {
      return { winner: nonHazardWinners[0], length: maxLength, tied: [] };
    }
    // Still tied among non-hazard holders - needs overdrive
    return { winner: null, length: maxLength, tied: nonHazardWinners };
  }

  // No hazard holder in tie, or hazard holder not in tie - needs overdrive
  return { winner: null, length: maxLength, tied: tiedIds };
}

/**
 * Execute overdrive protocol for tie-break.
 * Tied players take turns drawing from uncharted and extending their trails.
 * 
 * Phase 3: If uncharted depletes, cannibalize Neutral Zone and non-tied trails
 * to create Emergency Sectors.
 */
export function executeOverdriveTieBreak(
  tiedPlayers: readonly PlayerId[],
  trails: Readonly<Record<PlayerId, readonly { coordinate: Coordinate }[]>>,
  unchartedSectors: readonly Coordinate[],
  turnOrder: readonly PlayerId[],
  neutralZone?: readonly { coordinate: Coordinate }[]
): { winner: PlayerId | null; extensions: Readonly<Record<PlayerId, number>> } {
  if (tiedPlayers.length < 2) {
    return { winner: tiedPlayers[0] ?? null, extensions: {} };
  }

  // Order tied players by table position (after round-ender)
  const orderedTied = turnOrder.filter((id) => tiedPlayers.includes(id));

  let remaining = [...unchartedSectors];
  const extensions: Record<PlayerId, number> = {};

  for (const playerId of orderedTied) {
    extensions[playerId] = 0;
  }

  // Each tied player draws until they get a dead tile
  for (const playerId of orderedTied) {
    const trail = trails[playerId] ?? [];
    if (trail.length === 0) {
      continue; // No trail to extend
    }

    const lastPlaced = trail[trail.length - 1];
    // Trail endpoint is the "high" end after normalizeCoordinate
    let currentEndpoint = lastPlaced.coordinate.high;

    while (remaining.length > 0) {
      const [drawn, ...rest] = remaining;

      if (!coordinateMatches(drawn, currentEndpoint)) {
        // Dead tile - discard back to pool and stop
        // Note: Rules say "discard face-down back into boneyard"
        // We just leave it in remaining for next player
        break;
      }

      // Matches - extend trail
      extensions[playerId]++;
      currentEndpoint = getOppositeEnd(drawn, currentEndpoint);
      remaining = rest;
    }

    // Phase 3: Emergency Sectors (Sector Cannibalization)
    // If this player depleted remaining tiles and still tied, create emergency sectors
    if (remaining.length === 0 && playerId !== orderedTied[orderedTied.length - 1]) {
      // Collect tiles from Neutral Zone and non-tied player trails
      const emergencyTiles: Coordinate[] = [];
      
      // Add Neutral Zone tiles
      if (neutralZone) {
        for (const placed of neutralZone) {
          emergencyTiles.push(placed.coordinate);
        }
      }
      
      // Add tiles from non-tied players' trails
      for (const [captainId, trail] of Object.entries(trails)) {
        if (!tiedPlayers.includes(captainId)) {
          for (const placed of trail) {
            emergencyTiles.push(placed.coordinate);
          }
        }
      }
      
      // If we got emergency tiles, shuffle and continue
      if (emergencyTiles.length > 0) {
        // Shuffle emergency sectors (face-down scramble)
        // Simple Fisher-Yates shuffle
        for (let i = emergencyTiles.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [emergencyTiles[i], emergencyTiles[j]] = [emergencyTiles[j], emergencyTiles[i]];
        }
        remaining = emergencyTiles;
      }
      // Else: Total depletion edge case - no tiles available, tie persists
    }
  }

  // Find player with most extensions
  const maxExtension = Math.max(...Object.values(extensions));
  const winnersAfterOverdrive = orderedTied.filter(
    (id) => extensions[id] === maxExtension
  );

  if (winnersAfterOverdrive.length === 1) {
    return { winner: winnersAfterOverdrive[0], extensions };
  }

  // Still tied - neither gets bonus
  return { winner: null, extensions };
}
