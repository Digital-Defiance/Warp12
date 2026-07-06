import { describe, expect, it } from 'vitest';

import {
  charterHouseRulesMatch,
  charterModulesMatch,
  OFFICIAL_CHARTER_HOUSE_RULES,
  OFFICIAL_CHARTER_MODULES,
} from './charter-lobby-config.js';
import { charterMatchesRatedEvent } from './apply-group-tei.js';

describe('charter lobby matching', () => {
  const charter = {
    objective: 'points' as const,
    playerCount: 4,
    rulesProfileId: 'warp12-official-v1',
    campaignRounds: 13,
    modules: { ...OFFICIAL_CHARTER_MODULES },
    houseRules: { ...OFFICIAL_CHARTER_HOUSE_RULES },
  };

  it('accepts identical module and house-rule snapshots', () => {
    expect(
      charterMatchesRatedEvent(charter, {
        ...charter,
        modules: { ...OFFICIAL_CHARTER_MODULES },
        houseRules: { ...OFFICIAL_CHARTER_HOUSE_RULES },
      })
    ).toBe(true);
  });

  it('rejects subspace fracture drift', () => {
    expect(
      charterModulesMatch(charter, {
        ...OFFICIAL_CHARTER_MODULES,
        subspaceFracture: true,
      })
    ).toBe(false);
  });

  it('rejects double-zero scoring drift', () => {
    expect(
      charterHouseRulesMatch(charter, {
        ...OFFICIAL_CHARTER_HOUSE_RULES,
        doubleZeroScore: 50,
      })
    ).toBe(false);
  });

  it('defaults missing charter fields to official Warp 12', () => {
    expect(
      charterMatchesRatedEvent(
        {
          objective: 'points',
          playerCount: 4,
          rulesProfileId: 'warp12-official-v1',
          campaignRounds: 13,
        },
        {
          objective: 'points',
          playerCount: 4,
          rulesProfileId: 'warp12-official-v1',
          campaignRounds: 13,
          modules: { ...OFFICIAL_CHARTER_MODULES },
          houseRules: { ...OFFICIAL_CHARTER_HOUSE_RULES },
        }
      )
    ).toBe(true);
  });
});
