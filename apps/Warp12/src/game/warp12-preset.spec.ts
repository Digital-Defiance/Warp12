import { describe, expect, it } from 'vitest';

import {
  WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  officialRulesLabel,
  officialRulesSummary,
  warp12OfficialCreateLobbyOptions,
} from './warp12-preset.js';

describe('warp12-preset', () => {
  it('enables Salamander, Continuum, and Drop to Impulse with a one-tile catch', () => {
    expect(WARP12_OFFICIAL_MODULES.salamanderPenalty).toBe(true);
    expect(WARP12_OFFICIAL_MODULES.continuum).toBe(true);
    expect(WARP12_OFFICIAL_MODULES.subspaceFracture).toBe(false);
    expect(WARP12_OFFICIAL_HOUSE_RULES.dropToImpulseCall).toBe(true);
    expect(WARP12_OFFICIAL_HOUSE_RULES.dropToImpulseCatchPenalty).toBe(1);
    expect(WARP12_OFFICIAL_HOUSE_RULES.doubleZeroScore).toBe(0);
  });

  it('builds online lobby defaults from the official bundle', () => {
    const options = warp12OfficialCreateLobbyOptions({ maxPlayers: 6 });
    expect(options.maxPlayers).toBe(6);
    expect(options.objective).toBe('points');
    expect(options.campaignRounds).toBe(WARP12_OFFICIAL_CAMPAIGN_ROUNDS);
    expect(options.modules?.salamanderPenalty).toBe(true);
    expect(options.modules?.continuum).toBe(true);
    expect(options.houseRules?.dropToImpulseCall).toBe(true);
  });

  it('labels and summarizes official rules per Warp factor', () => {
    expect(officialRulesLabel(12)).toBe('Official Warp 12 rules');
    expect(officialRulesLabel(9)).toBe('Official Warp 9 rules');
    expect(officialRulesSummary(12)).toMatch(/13 rounds/);
    expect(officialRulesSummary(18)).toMatch(/19 rounds/);
    expect(officialRulesSummary(15)).toMatch(/Exhibition set/);
  });
});
