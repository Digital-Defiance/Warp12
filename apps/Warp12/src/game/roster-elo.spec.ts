import { describe, expect, it } from 'vitest';

import {
  buildLocalRosterTei,
  buildOnlineRosterClasses,
  rosterHasTacticalClasses,
} from './roster-elo.js';

describe('buildOnlineRosterClasses', () => {
  const captains = [
    { id: 'you', isAi: false },
    { id: 'riker', isAi: true, skill: 'commander' as const },
    { id: 'troi', isAi: true, skill: 'lieutenant' as const },
  ];

  it('shows AI officers with reference TEI + class; humans as unrated', () => {
    const roster = buildOnlineRosterClasses(
      ['you', 'riker', 'troi'],
      captains,
      'points'
    );

    expect(roster[0]).toEqual({ captainId: 'you', tei: null });
    expect(roster[1]).toMatchObject({
      captainId: 'riker',
      reference: true,
      tacticalClass: 'Class II',
    });
    expect(typeof roster[1]?.tei).toBe('number');
    expect(roster[2]).toMatchObject({
      captainId: 'troi',
      reference: true,
      tacticalClass: 'Class III',
    });
    expect(typeof roster[2]?.tei).toBe('number');
    expect(rosterHasTacticalClasses(roster)).toBe(true);
  });

  it('uses the objective for the reference TEI (points vs go-out differ)', () => {
    const points = buildOnlineRosterClasses(['riker'], captains, 'points');
    const goOut = buildOnlineRosterClasses(['riker'], captains, 'go-out');
    expect(points[0]?.tei).not.toBe(goOut[0]?.tei);
  });

  it('reports no tactical classes when the table is all-human', () => {
    const roster = buildOnlineRosterClasses(
      ['you', 'data'],
      [
        { id: 'you', isAi: false },
        { id: 'data', isAi: false },
      ],
      'points'
    );
    expect(rosterHasTacticalClasses(roster)).toBe(false);
  });
});

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
            omega: true,
          },
        ],
      },
      null,
      'points'
    );

    expect(roster[1]?.tacticalClass).toMatch(/Class II/);
  });
});
