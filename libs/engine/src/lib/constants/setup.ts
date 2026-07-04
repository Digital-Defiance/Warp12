/** Hand sizes by fleet size (RULES.md §II). */
export const HAND_SIZE_BY_PLAYER_COUNT: Readonly<Record<number, number>> = {
  2: 15,
  3: 15,
  4: 15,
  5: 12,
  6: 12,
  7: 10,
  8: 10,
};

/** Total coordinates in a double-twelve set. */
export const DOUBLE_TWELVE_SET_SIZE = 91;

/** Highest pip value in a double-twelve set. */
export const DOUBLE_TWELVE_MAX_PIPS = 12;

/** Starting Spacedock double for round 1. */
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
 * Salamander Penalty: a held 12-12 scores DOUBLE its pips (round 2+). Base pips
 * are already 24 (both ends), so the penalty value is 48.
 */
export const SALAMANDER_PENALTY_TILE_VALUE = TWELVE_TWELVE_PIP_VALUE * 2;



export function clampCampaignRounds(rounds: number): number {
  return Math.min(
    MAX_CAMPAIGN_ROUNDS,
    Math.max(MIN_CAMPAIGN_ROUNDS, Math.round(rounds))
  );
}

export function formatCampaignRoundProgress(
  roundNumber: number,
  campaignRounds: number
): string {
  return `Round ${roundNumber} of ${campaignRounds}`;
}

export function handSizeForPlayerCount(playerCount: number): number {
  const size = HAND_SIZE_BY_PLAYER_COUNT[playerCount];
  if (size === undefined) {
    throw new RangeError(
      `Warp 12 supports 2–8 captains; received ${playerCount}.`
    );
  }
  return size;
}

export function spacedockValueForRound(roundNumber: number): number {
  if (roundNumber < 1 || roundNumber > 13) {
    throw new RangeError(
      `Round number must be 1–13 for a double-twelve set; received ${roundNumber}.`
    );
  }
  return INITIAL_SPACEDOCK_VALUE - (roundNumber - 1);
}

/** 12-12 is set aside as Spacedock in round 1; Salamander applies from round 2 onward. */
export function salamanderPenaltyApplies(roundNumber: number): boolean {
  return roundNumber > 1;
}
