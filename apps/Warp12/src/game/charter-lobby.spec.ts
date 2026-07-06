import { describe, expect, it } from 'vitest';

import type { PublicCharterView } from '../firebase/charter-service.js';
import { lobbyOptionsFromCharter } from './charter-lobby.js';
import {
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
} from './warp12-preset.js';

function sampleCrew(
  overrides: Partial<PublicCharterView> = {}
): PublicCharterView {
  return {
    charterId: 'crew-oak',
    slug: 'oak-street',
    name: 'Oak Street Crew',
    rulesProfileId: 'warp12-official-v1',
    objective: 'points',
    playerCount: 6,
    campaignRounds: 13,
    isGlobalOfficial: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('lobbyOptionsFromCharter', () => {
  it('maps a crew charter into sector create options', () => {
    const crew = sampleCrew({
      modules: {
        salamanderPenalty: true,
        qContinuum: false,
        subspaceFracture: true,
        subspaceFractureScope: 'all-doubles',
      },
      houseRules: {
        ...WARP12_OFFICIAL_HOUSE_RULES,
        doubleZeroScore: 25,
        dropToImpulseCall: false,
      },
    });

    const options = lobbyOptionsFromCharter(crew, { rated: false });

    expect(options).toEqual({
      rated: false,
      charterId: 'crew-oak',
      rulesProfileId: 'warp12-official-v1',
      objective: 'points',
      campaignRounds: 13,
      maxPlayers: 6,
      modules: {
        salamanderPenalty: true,
        qContinuum: false,
        subspaceFracture: true,
        subspaceFractureScope: 'all-doubles',
      },
      houseRules: {
        ...WARP12_OFFICIAL_HOUSE_RULES,
        doubleZeroScore: 25,
        dropToImpulseCall: false,
      },
    });
  });

  it('defaults missing lobby fields to Official Warp 12 (legacy charters)', () => {
    const options = lobbyOptionsFromCharter(sampleCrew());

    expect(options.modules).toEqual({ ...WARP12_OFFICIAL_MODULES });
    expect(options.houseRules).toEqual({ ...WARP12_OFFICIAL_HOUSE_RULES });
    expect(options.rated).toBe(true);
  });

  it('copies module and house-rule objects so callers cannot mutate the charter', () => {
    const crew = sampleCrew({
      modules: { ...WARP12_OFFICIAL_MODULES, subspaceFracture: true },
      houseRules: { ...WARP12_OFFICIAL_HOUSE_RULES },
    });

    const options = lobbyOptionsFromCharter(crew);
    options.modules!.subspaceFracture = false;
    options.houseRules!.dropToImpulseCall = false;

    expect(crew.modules?.subspaceFracture).toBe(true);
    expect(crew.houseRules?.dropToImpulseCall).toBe(true);
  });
});
