import { describe, expect, it } from 'vitest';

import {
  WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
  warp12OfficialCreateLobbyOptions,
} from './warp12-preset.js';

describe('warp12-preset', () => {
  it('enables Salamander, Q-Continuum, and Drop to Impulse with a one-tile catch', () => {
    expect(WARP12_OFFICIAL_MODULES.salamanderPenalty).toBe(true);
    expect(WARP12_OFFICIAL_MODULES.qContinuum).toBe(true);
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
    expect(options.modules?.qContinuum).toBe(true);
    expect(options.houseRules?.dropToImpulseCall).toBe(true);
  });
});
