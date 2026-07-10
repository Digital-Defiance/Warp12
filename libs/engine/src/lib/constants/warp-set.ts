/** Supported Warp set sizes (double-N max pip). */
export const WARP_FACTORS = [9, 12, 15, 18] as const;

export type WarpFactor = (typeof WARP_FACTORS)[number];

export function isWarpFactor(value: number): value is WarpFactor {
  return (WARP_FACTORS as readonly number[]).includes(value);
}

export function normalizeWarpFactor(value: number | undefined): WarpFactor {
  const candidate = value ?? NaN;
  return isWarpFactor(candidate) ? candidate : 12;
}

/** Tile count for a double-N set: (N+1)(N+2)/2. */
export function coordinateSetSize(maxPip: number): number {
  return ((maxPip + 1) * (maxPip + 2)) / 2;
}

export interface WarpSetProfile {
  readonly maxPip: WarpFactor;
  /** Total tiles in the set. */
  readonly tileCount: number;
  /** Points campaign length (maxPip → 0 inclusive). */
  readonly campaignRounds: number;
  /** Soft fleet cap for this set. */
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly handSizeByPlayerCount: Readonly<Record<number, number>>;
}

/**
 * Double-12 hand sizes (RULES.md §II) — also the 2–8 baseline for larger sets.
 */
export const DOUBLE_TWELVE_HAND_SIZES: Readonly<Record<number, number>> = {
  2: 15,
  3: 15,
  4: 15,
  5: 12,
  6: 12,
  7: 10,
  8: 10,
};

/** Compact double-9 fleets (2–4). */
export const DOUBLE_NINE_HAND_SIZES: Readonly<Record<number, number>> = {
  2: 12,
  3: 9,
  4: 7,
};

/** Double-15 fleets up to 12 captains (hub = captains + Neutral Zone arm). */
export const DOUBLE_FIFTEEN_HAND_SIZES: Readonly<Record<number, number>> = {
  ...DOUBLE_TWELVE_HAND_SIZES,
  9: 9,
  10: 9,
  11: 8,
  12: 8,
};

/** Double-18 fleets up to 18 captains. */
export const DOUBLE_EIGHTEEN_HAND_SIZES: Readonly<Record<number, number>> = {
  ...DOUBLE_FIFTEEN_HAND_SIZES,
  13: 8,
  14: 7,
  15: 7,
  16: 7,
  17: 6,
  18: 6,
};

export const WARP_SET_PROFILES: Readonly<Record<WarpFactor, WarpSetProfile>> = {
  9: {
    maxPip: 9,
    tileCount: coordinateSetSize(9),
    campaignRounds: 10,
    minPlayers: 2,
    maxPlayers: 4,
    handSizeByPlayerCount: DOUBLE_NINE_HAND_SIZES,
  },
  12: {
    maxPip: 12,
    tileCount: coordinateSetSize(12),
    campaignRounds: 13,
    minPlayers: 2,
    maxPlayers: 8,
    handSizeByPlayerCount: DOUBLE_TWELVE_HAND_SIZES,
  },
  15: {
    maxPip: 15,
    tileCount: coordinateSetSize(15),
    campaignRounds: 16,
    minPlayers: 2,
    maxPlayers: 12,
    handSizeByPlayerCount: DOUBLE_FIFTEEN_HAND_SIZES,
  },
  18: {
    maxPip: 18,
    tileCount: coordinateSetSize(18),
    campaignRounds: 19,
    minPlayers: 2,
    maxPlayers: 18,
    handSizeByPlayerCount: DOUBLE_EIGHTEEN_HAND_SIZES,
  },
};

export function warpSetProfile(maxPip: number): WarpSetProfile {
  return WARP_SET_PROFILES[normalizeWarpFactor(maxPip)];
}

/** Base pip value of the highest double (both ends). */
export function highestDoublePipValue(maxPip: number): number {
  return maxPip * 2;
}

/** Salamander: held highest double scores double its pips (round 2+). */
export function salamanderPenaltyTileValue(maxPip: number): number {
  return highestDoublePipValue(maxPip) * 2;
}

export function isHighestDouble(
  coordinate: { low: number; high: number },
  maxPip: number
): boolean {
  return coordinate.low === maxPip && coordinate.high === maxPip;
}
