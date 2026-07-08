/** Frozen rules bundle IDs for charter matching (see docs/crews-roadmap.md). */
export const WARP12_OFFICIAL_V1_RULES_PROFILE_ID =
  'warp12-official-v1' as const;

/** Neural Class II (Ω) with recalibrated commander REF_TEI — default for new rated play. */
export const WARP12_OFFICIAL_V2_RULES_PROFILE_ID =
  'warp12-official-v2' as const;

/** Default rules profile for new sectors, local rated play, and crew charters. */
export const WARP12_OFFICIAL_RULES_PROFILE_ID =
  WARP12_OFFICIAL_V2_RULES_PROFILE_ID;

export const GLOBAL_OFFICIAL_CHARTER_ID = 'global-official' as const;
export const GLOBAL_OFFICIAL_SLUG = 'global-official' as const;

export type RulesProfileId =
  | typeof WARP12_OFFICIAL_V1_RULES_PROFILE_ID
  | typeof WARP12_OFFICIAL_V2_RULES_PROFILE_ID
  | string;

export interface RulesProfileMeta {
  readonly id: RulesProfileId;
  readonly label: string;
  readonly summary: string;
}

export const RULES_PROFILE_CATALOG: Readonly<Record<string, RulesProfileMeta>> =
  {
    [WARP12_OFFICIAL_V1_RULES_PROFILE_ID]: {
      id: WARP12_OFFICIAL_V1_RULES_PROFILE_ID,
      label: 'Official Warp 12 (legacy)',
      summary:
        'Heuristic Class II officers at REF_TEI 1400/1500. Pinned for existing crews.',
    },
    [WARP12_OFFICIAL_V2_RULES_PROFILE_ID]: {
      id: WARP12_OFFICIAL_V2_RULES_PROFILE_ID,
      label: 'Official Warp 12',
      summary:
        'Neural Class II (Ω) officers; recalibrated TEI anchors (1520 points / 1550 go-out).',
    },
  };

export const SUPPORTED_OFFICIAL_RULES_PROFILE_IDS = [
  WARP12_OFFICIAL_V1_RULES_PROFILE_ID,
  WARP12_OFFICIAL_V2_RULES_PROFILE_ID,
] as const;

export function isSupportedOfficialRulesProfile(id: string): boolean {
  return (SUPPORTED_OFFICIAL_RULES_PROFILE_IDS as readonly string[]).includes(
    id
  );
}

export function rulesProfileLabel(id: string): string {
  return RULES_PROFILE_CATALOG[id]?.label ?? id;
}

export function charterSummaryLine(input: {
  name: string;
  rulesProfileId: string;
  playerCount: number;
  objective: 'points' | 'go-out';
  campaignRounds?: number;
}): string {
  const rules = rulesProfileLabel(input.rulesProfileId);
  const objective =
    input.objective === 'go-out' ? 'Go-out' : 'Points';
  const rounds =
    input.objective === 'points' && input.campaignRounds
      ? ` · ${input.campaignRounds} rounds`
      : '';
  return `${input.name} — ${rules} · ${input.playerCount} captains · ${objective}${rounds}`;
}
