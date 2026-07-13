import {
  DOUBLE_TWELVE_HAND_SIZES,
  normalizeWarpFactor,
  salamanderPenaltyTileValue,
  warpSetProfile,
  type WarpFactor,
} from './warp-set.js';

/** @deprecated Prefer {@link DOUBLE_TWELVE_HAND_SIZES} / {@link warpSetProfile}. */
export const HAND_SIZE_BY_PLAYER_COUNT: Readonly<Record<number, number>> =
  DOUBLE_TWELVE_HAND_SIZES;

/**
 * Hand size for large fleets (7–8 captains) is the one setup value where major
 * published rule sets genuinely disagree: Masters of Games and most modern /
 * commercial sets deal **10**, while Galt 1994 and University Games deal **11**.
 * Warp 12 defaults to 10 (healthier boneyard) and lets a host opt into 11.
 */
export type LargeFleetHandSize = 10 | 11;

/** Warp 12 default for 7–8 captains (see {@link LargeFleetHandSize}). */
export const DEFAULT_LARGE_FLEET_HAND_SIZE: LargeFleetHandSize = 10;

/** Fleet sizes affected by the large-fleet hand-size choice. */
export const LARGE_FLEET_PLAYER_COUNTS: readonly number[] = [7, 8];

export const DOUBLE_NINE_SET_SIZE = 55;

/** Total coordinates in a double-twelve set. */
export const DOUBLE_TWELVE_SET_SIZE = 91;

export const DOUBLE_FIFTEEN_SET_SIZE = 136;

export const DOUBLE_EIGHTEEN_SET_SIZE = 190;

/** Highest pip value in a double-twelve set. */
export const DOUBLE_TWELVE_MAX_PIPS = 12;

/** Starting Spacedock double for round 1 (double-twelve). */
export const INITIAL_SPACEDOCK_VALUE = 12;

/** Default points campaign length (12-12 through 0-0). */
export const DEFAULT_CAMPAIGN_ROUNDS = 13;

/** Shortest points campaign (single spacedock round). */
export const MIN_CAMPAIGN_ROUNDS = 1;

/** Longest points campaign for a double-twelve set. */
export const MAX_CAMPAIGN_ROUNDS = 13;

/** Base pip value of the 12-12 tile (both ends). */
export const TWELVE_TWELVE_PIP_VALUE = 24;

/**
 * Maximum tiles that can be drawn in a single Warp Drive Spool operation.
 * Prevents infinite loops and bounds the operation.
 */
export const MAX_SPOOL_TILES = 30;

/**
 * Module Delta: Hot Potato (Hazard Marker)
 * 
 * Simple hot potato mechanic:
 * - Round starter gets hazard marker
 * - Transfers when you play to Neutral Zone
 * - If you PASS while holding it: +5 points penalty
 */
export const HAZARD_MARKER_PASS_PENALTY = 5;

/**
 * Salamander Penalty: a held 12-12 scores DOUBLE its pips (round 2+). Base pips
 * are already 24 (both ends), so the penalty value is 48.
 * @deprecated Prefer {@link salamanderPenaltyTileValue}(maxPip).
 */
export const SALAMANDER_PENALTY_TILE_VALUE = TWELVE_TWELVE_PIP_VALUE * 2;

export function clampCampaignRounds(
  rounds: number,
  maxPip: number = DOUBLE_TWELVE_MAX_PIPS
): number {
  const profile = warpSetProfile(maxPip);
  return Math.min(
    profile.campaignRounds,
    Math.max(MIN_CAMPAIGN_ROUNDS, Math.round(rounds))
  );
}

export function defaultCampaignRounds(maxPip: number): number {
  return warpSetProfile(maxPip).campaignRounds;
}

export function formatCampaignRoundProgress(
  roundNumber: number,
  campaignRounds: number
): string {
  return `Round ${roundNumber} of ${campaignRounds}`;
}

export function handSizeForPlayerCount(
  playerCount: number,
  largeFleetHandSize: LargeFleetHandSize = DEFAULT_LARGE_FLEET_HAND_SIZE,
  maxPip: number = DOUBLE_TWELVE_MAX_PIPS
): number {
  const profile = warpSetProfile(maxPip);
  const size = profile.handSizeByPlayerCount[playerCount];
  if (size === undefined) {
    throw new RangeError(
      `Warp ${profile.maxPip} supports ${profile.minPlayers}–${profile.maxPlayers} captains; received ${playerCount}.`
    );
  }
  // 7–8 captains on double-12+ fleets: honor the host's opt-in.
  if (
    profile.maxPip >= 12 &&
    LARGE_FLEET_PLAYER_COUNTS.includes(playerCount)
  ) {
    return largeFleetHandSize;
  }
  return size;
}

export function spacedockValueForRound(
  roundNumber: number,
  maxPip: number = DOUBLE_TWELVE_MAX_PIPS
): number {
  const factor = normalizeWarpFactor(maxPip);
  const maxRounds = factor + 1;
  if (roundNumber < 1 || roundNumber > maxRounds) {
    throw new RangeError(
      `Round number must be 1–${maxRounds} for a double-${factor} set; received ${roundNumber}.`
    );
  }
  return factor - (roundNumber - 1);
}

/** Highest double is Spacedock in round 1; Salamander applies from round 2 onward. */
export function salamanderPenaltyApplies(roundNumber: number): boolean {
  return roundNumber > 1;
}

export type { WarpFactor };
export {
  WARP_FACTORS,
  WARP_SET_PROFILES,
  coordinateSetSize,
  highestDoublePipValue,
  isHighestDouble,
  isWarpFactor,
  normalizeWarpFactor,
  salamanderPenaltyTileValue,
  warpSetProfile,
} from './warp-set.js';
