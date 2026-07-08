import { describe, expect, it } from 'vitest';

import {
  buildCaptainTacticalClassAbbrevById,
  buildCaptainTacticalClassLabelById,
} from './captain-tactical-class.js';

describe('captain-tactical-class', () => {
  it('shows Class II for commander officers (neural Ω)', () => {
    const localConfig = {
      humanId: 'you',
      humanName: 'Picard',
      humanCaptains: [{ id: 'you', displayName: 'Picard' }],
      playerCount: 4,
      objective: 'go-out' as const,
      campaignRounds: 13,
      modules: {},
      aiCaptains: [
        {
          id: 'riker',
          displayName: 'Riker',
          skill: 'commander' as const,
        },
      ],
    };

    expect(
      buildCaptainTacticalClassAbbrevById({ localConfig }).riker
    ).toBe('Cls II');
    expect(
      buildCaptainTacticalClassLabelById({ localConfig }).riker
    ).toMatch(/Class II/);
  });

  it('shows the human captain tactical class from solo TEI', () => {
    const localConfig = {
      humanId: 'picard',
      humanName: 'Picard',
      humanCaptains: [{ id: 'picard', displayName: 'Picard' }],
      playerCount: 4,
      objective: 'points' as const,
      campaignRounds: 13,
      modules: {},
      aiCaptains: [
        {
          id: 'riker',
          displayName: 'Riker',
          skill: 'commander' as const,
        },
      ],
    };

    expect(
      buildCaptainTacticalClassAbbrevById({
        localConfig,
        humanId: 'picard',
        humanTei: 1420,
      }).picard
    ).toBe('Cls II');
    expect(
      buildCaptainTacticalClassLabelById({
        localConfig,
        humanId: 'picard',
        humanTei: null,
      }).picard
    ).toContain('Class IV');
  });
});
