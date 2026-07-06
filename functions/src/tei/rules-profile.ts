/** Frozen rules bundle IDs for charter matching (see docs/crews-roadmap.md). */
export const WARP12_OFFICIAL_RULES_PROFILE_ID = 'warp12-official-v1' as const;

export const GLOBAL_OFFICIAL_CHARTER_ID = 'global-official' as const;
export const GLOBAL_OFFICIAL_SLUG = 'global-official' as const;

export type RulesProfileId = typeof WARP12_OFFICIAL_RULES_PROFILE_ID | string;

export interface RulesProfileMeta {
  readonly id: RulesProfileId;
  readonly label: string;
  readonly summary: string;
}

export const RULES_PROFILE_CATALOG: Readonly<Record<string, RulesProfileMeta>> =
  {
    [WARP12_OFFICIAL_RULES_PROFILE_ID]: {
      id: WARP12_OFFICIAL_RULES_PROFILE_ID,
      label: 'Official Warp 12',
      summary:
        'Points campaign, Salamander penalty, Q-Continuum, Drop to Impulse, All Stop! ceremony.',
    },
  };

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
