import { describe, expect, it } from 'vitest';

import { buildLocalRosterTei } from './roster-elo.js';

describe('buildLocalRosterTei', () => {
  it('labels Class I* officers in the ratings line', () => {
    const roster = buildLocalRosterTei(
      {
        humanId: 'you',
        humanName: 'Picard',
        humanCaptains: [{ id: 'you', displayName: 'Picard' }],
        playerCount: 2,
        objective: 'points',
        campaignRounds: 13,
        modules: {},
        aiCaptains: [
          {
            id: 'riker',
            displayName: 'Riker',
            skill: 'commander',
            class1Star: true,
          },
        ],
      },
      null,
      'points'
    );

    expect(roster[1]?.tacticalClass).toBe('Class I*');
  });
});
