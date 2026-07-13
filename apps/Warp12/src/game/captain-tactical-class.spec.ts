import { describe, expect, it } from 'vitest';

import {
  buildCaptainTacticalClassAbbrevById,
  buildCaptainTacticalClassLabelById,
} from './captain-tactical-class.js';

describe('captain-tactical-class', () => {
  it('shows Cmdr. for commander officers (neural Ω)', () => {
    const localConfig = {
      humanId: 'you',
      humanName: 'Armstrong',
      humanCaptains: [{ id: 'you', displayName: 'Armstrong' }],
      playerCount: 4,
      objective: 'go-out' as const,
      campaignRounds: 13,
      modules: {},
      aiCaptains: [
        {
          id: 'lovell',
          displayName: 'Lovell',
          skill: 'commander' as const,
        },
      ],
    };

    expect(
      buildCaptainTacticalClassAbbrevById({ localConfig }).lovell
    ).toBe('Cmdr.');
    expect(
      buildCaptainTacticalClassLabelById({ localConfig }).lovell
    ).toMatch(/Commander/);
  });

  it('shows human federation commission from full TEI grade', () => {
    const localConfig = {
      humanId: 'armstrong',
      humanName: 'Armstrong',
      humanCaptains: [{ id: 'armstrong', displayName: 'Armstrong' }],
      playerCount: 4,
      objective: 'points' as const,
      campaignRounds: 13,
      modules: {},
      aiCaptains: [
        {
          id: 'lovell',
          displayName: 'Lovell',
          skill: 'commander' as const,
        },
      ],
    };

    expect(
      buildCaptainTacticalClassAbbrevById({
        localConfig,
        humanId: 'armstrong',
        humanTei: 'V62',
      }).armstrong
    ).toBe('Cmdr.');
    expect(
      buildCaptainTacticalClassLabelById({
        localConfig,
        humanId: 'armstrong',
        humanTei: 'I28',
      }).armstrong
    ).toBe('Lieutenant Junior Grade');
    expect(
      buildCaptainTacticalClassAbbrevById({
        localConfig,
        humanId: 'armstrong',
        humanTei: null,
      }).armstrong
    ).toBe('Cdt.');
  });
});
