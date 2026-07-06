import {
  GLOBAL_OFFICIAL_CHARTER_ID,
  GLOBAL_OFFICIAL_SLUG,
} from './rules-profile';

/** Fleet sizes with an open Global Official charter this season. */
export const GLOBAL_OFFICIAL_PLAYER_COUNTS = [4, 6, 8] as const;

export type GlobalOfficialPlayerCount =
  (typeof GLOBAL_OFFICIAL_PLAYER_COUNTS)[number];

export function globalOfficialCharterId(playerCount: number): string {
  if (playerCount === 4) {
    return GLOBAL_OFFICIAL_CHARTER_ID;
  }
  return `global-official-${playerCount}p`;
}

export function globalOfficialSlug(playerCount: number): string {
  if (playerCount === 4) {
    return GLOBAL_OFFICIAL_SLUG;
  }
  return `global-official-${playerCount}p`;
}

export function parseGlobalOfficialFleetSize(
  charterIdOrSlug: string
): number | null {
  const normalized = charterIdOrSlug.trim().toLowerCase();
  if (
    normalized === GLOBAL_OFFICIAL_CHARTER_ID ||
    normalized === GLOBAL_OFFICIAL_SLUG
  ) {
    return 4;
  }
  const match = /^global-official-(\d+)p$/.exec(normalized);
  if (!match) {
    return null;
  }
  const count = Number(match[1]);
  if (count < 2 || count > 8) {
    return null;
  }
  return count;
}

export function isGlobalOfficialCharterId(charterId: string): boolean {
  return parseGlobalOfficialFleetSize(charterId) !== null;
}

export function normalizeSeasonKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
