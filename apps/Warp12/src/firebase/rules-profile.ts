/** Frozen rules bundle IDs for charter matching (see docs/crews-roadmap.md). */
export const WARP12_OFFICIAL_V1_RULES_PROFILE_ID =
  'warp12-official-v1' as const;

export const WARP12_OFFICIAL_V2_RULES_PROFILE_ID =
  'warp12-official-v2' as const;

export const WARP12_OFFICIAL_RULES_PROFILE_ID =
  WARP12_OFFICIAL_V2_RULES_PROFILE_ID;

export const GLOBAL_OFFICIAL_CHARTER_ID = 'global-official' as const;

export const SUPPORTED_OFFICIAL_RULES_PROFILE_IDS = [
  WARP12_OFFICIAL_V1_RULES_PROFILE_ID,
  WARP12_OFFICIAL_V2_RULES_PROFILE_ID,
] as const;

export function isSupportedOfficialRulesProfile(id: string): boolean {
  return (SUPPORTED_OFFICIAL_RULES_PROFILE_IDS as readonly string[]).includes(
    id
  );
}
