import { describe, expect, it } from 'vitest';

import {
  buildCaptainTacticalClassAbbrevById,
  buildCaptainTacticalClassLabelById,
} from './captain-tactical-class.js';

describe('captain-tactical-class', () => {
  it('shows Class I* for class1Star officers', () => {
    const localConfig = {
      humanId: 'you',
      humanName: 'Picard',
      playerCount: 4,
      objective: 'go-out' as const,
      campaignRounds: 13,
      modules: {},
      aiCaptains: [
        {
          id: 'riker',
          displayName: 'Riker',
          skill: 'commander' as const,
          class1Star: true,
        },
      ],
    };

    expect(
      buildCaptainTacticalClassAbbrevById({ localConfig }).riker
    ).toBe('Cls I*');
    expect(
      buildCaptainTacticalClassLabelById({ localConfig }).riker
    ).toBe('Class I*');
  });

  it('shows the human captain tactical class from solo TEI', () => {
    const localConfig = {
      humanId: 'picard',
      humanName: 'Picard',
      playerCount: 4,
      objective: 'points' as const,
      campaignRounds: 13,
      modules: {},
      aiCaptains: [
        {
          id: 'riker',
          displayName: 'Riker',
          skill: 'commander' as const,
          class1Star: true,
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
