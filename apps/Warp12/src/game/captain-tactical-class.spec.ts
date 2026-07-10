import { describe, expect, it } from 'vitest';

import {
  buildCaptainTacticalClassAbbrevById,
  buildCaptainTacticalClassLabelById,
} from './captain-tactical-class.js';

describe('captain-tactical-class', () => {
  it('shows Class II for commander officers (neural Ω)', () => {
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
    ).toBe('Cls II');
    expect(
      buildCaptainTacticalClassLabelById({ localConfig }).lovell
    ).toMatch(/Class II/);
  });

  it('shows the human captain tactical class from solo TEI', () => {
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
        humanTei: 1420,
      }).armstrong
    ).toBe('Cls II');
    expect(
      buildCaptainTacticalClassLabelById({
        localConfig,
        humanId: 'armstrong',
        humanTei: null,
      }).armstrong
    ).toContain('Class IV');
  });
});
