import { describe, expect, it } from 'vitest';
import { resolveHouseRules, type GameState } from 'warp12-engine';

import type { FirestoreCaptain } from './schema.js';
import {
  applyHumanTeiSelfUpdate,
  buildHumanSectorRankTable,
  hasRatedHumanSector,
  isHumanOnlySector,
  onlineMatchRatingEligibility,
  onlineRatingWarning,
  onlineUnratedNotice,
} from './human-tei.js';
import type { PlayerStatsDocument } from './stats-schema.js';

function completePointsGame(
  scores: Record<string, number>,
  id = 'sector-1'
): GameState {
  return {
    id,
    phase: 'complete',
    objective: 'points',
    campaignRounds: 4,
    completedRounds: 4,
    modules: {
      continuum: false,
      salamanderPenalty: true,
      subspaceFracture: false,
      subspaceFractureScope: 'own-trail',
    },
    houseRules: resolveHouseRules({}),
    captains: Object.entries(scores).map(([captainId, pointsScore]) => ({
      id: captainId,
      displayName: captainId,
      pointsScore,
    })),
    round: null,
  };
}

describe('isHumanOnlySector', () => {
  it('requires at least two human captains and no AI', () => {
    const humans: FirestoreCaptain[] = [
      { id: 'u1', displayName: 'A', pointsScore: 0, joinedAt: '' },
      { id: 'u2', displayName: 'B', pointsScore: 0, joinedAt: '' },
    ];
    expect(isHumanOnlySector(humans)).toBe(true);
    expect(
      isHumanOnlySector([
        ...humans,
        {
          id: 'ai-lieutenant',
          displayName: 'Bot',
          pointsScore: 0,
          joinedAt: '',
          isAi: true,
        },
      ])
    ).toBe(false);
    expect(isHumanOnlySector([humans[0]!])).toBe(false);
  });
});

describe('buildHumanSectorRankTable', () => {
  it('ranks captains by points score ascending', () => {
    const game = completePointsGame({ u1: 12, u2: 40 });
    const teiByUid = new Map([
      ['u1', { tei: 1200, matches: 5 }],
      ['u2', { tei: 1100, matches: 3 }],
    ]);
    const table = buildHumanSectorRankTable(game, ['u1', 'u2'], teiByUid);
    expect(table).toEqual([
      expect.objectContaining({ playerId: 'u1', rank: 1, tei: 1200 }),
      expect.objectContaining({ playerId: 'u2', rank: 2, tei: 1100 }),
    ]);
  });
});

describe('applyHumanTeiSelfUpdate', () => {
  it('raises TEI for winner vs weaker field', () => {
    const table = [
      { playerId: 'u1', rank: 1, tei: 1200, unassistedMatches: 2 },
      { playerId: 'u2', rank: 2, tei: 1000, unassistedMatches: 2 },
    ];
    const result = applyHumanTeiSelfUpdate(null, 'points', table, 'u1');
    expect(result?.update.won).toBe(true);
    expect(result?.update.teiAfter).toBeGreaterThan(result!.update.teiBefore);
    expect(result?.humanTei.points?.unassistedMatches).toBe(1);
  });
});

describe('onlineMatchRatingEligibility', () => {
  const verifiedHuman = (id: string): FirestoreCaptain => ({
    id,
    displayName: id,
    pointsScore: 0,
    joinedAt: '',
    verified: true,
  });

  it('rates a sector of two or more verified humans', () => {
    const result = onlineMatchRatingEligibility(
      [verifiedHuman('u1'), verifiedHuman('u2')],
      'points'
    );
    expect(result.rated).toBe(true);
    expect(onlineRatingWarning(result, [])).toBeNull();
  });

  it('marks Warp 9 / 15 / 18 as exhibition (unrated)', () => {
    const result = onlineMatchRatingEligibility(
      [verifiedHuman('u1'), verifiedHuman('u2')],
      'points',
      true,
      18
    );
    expect(result).toEqual({
      rated: false,
      reason: 'exhibition_set',
      unratedCaptainIds: [],
    });
    expect(onlineRatingWarning(result, [])).toMatch(/Exhibition set/i);
  });

  it('rates verified humans anchored against Class II–IV AI', () => {
    const captains: FirestoreCaptain[] = [
      verifiedHuman('u1'),
      verifiedHuman('u2'),
      {
        id: 'ai:data',
        displayName: 'Data',
        pointsScore: 0,
        joinedAt: '',
        isAi: true,
        skill: 'commander',
      },
    ];
    expect(onlineMatchRatingEligibility(captains, 'go-out').rated).toBe(true);
  });

  it('is unrated when a human is a guest (unverified)', () => {
    const captains: FirestoreCaptain[] = [
      verifiedHuman('u1'),
      { id: 'u2', displayName: 'Guest', pointsScore: 0, joinedAt: '' },
    ];
    const result = onlineMatchRatingEligibility(captains, 'points');
    expect(result).toMatchObject({
      rated: false,
      reason: 'unrated_participant',
      unratedCaptainIds: ['u2'],
    });
    expect(onlineRatingWarning(result, captains)).toContain('Guest');
  });

  it('is unrated with fewer than two humans', () => {
    const captains: FirestoreCaptain[] = [
      verifiedHuman('u1'),
      {
        id: 'ai:data',
        displayName: 'Data',
        pointsScore: 0,
        joinedAt: '',
        isAi: true,
        skill: 'lieutenant',
      },
    ];
    expect(onlineMatchRatingEligibility(captains, 'points').reason).toBe(
      'not_enough_humans'
    );
  });

  it('rates sectors that include Class II (neural Ω) AI', () => {
    const captains = [
      verifiedHuman('u1'),
      verifiedHuman('u2'),
      {
        id: 'ai:lovell',
        displayName: 'Lovell',
        pointsScore: 0,
        joinedAt: '',
        isAi: true,
        skill: 'commander',
      },
    ] as FirestoreCaptain[];
    expect(onlineMatchRatingEligibility(captains, 'points')).toEqual({
      rated: true,
      unratedCaptainIds: [],
    });
  });

  it('is unrated when a legacy Class I* AI is aboard', () => {
    const captains = [
      verifiedHuman('u1'),
      verifiedHuman('u2'),
      {
        id: 'ai:lovell',
        displayName: 'Lovell',
        pointsScore: 0,
        joinedAt: '',
        isAi: true,
        skill: 'commander',
        class1Star: true,
      },
    ] as FirestoreCaptain[];
    expect(onlineMatchRatingEligibility(captains, 'points').reason).toBe(
      'unrated_ai'
    );
  });

  it('is unrated for non-rated objectives', () => {
    const result = onlineMatchRatingEligibility(
      [verifiedHuman('u1'), verifiedHuman('u2')],
      'team' as never
    );
    expect(result.reason).toBe('objective_not_rated');
  });

  it('is unrated (casual) when the host opts out of rating', () => {
    const result = onlineMatchRatingEligibility(
      [verifiedHuman('u1'), verifiedHuman('u2')],
      'points',
      false
    );
    expect(result).toMatchObject({ rated: false, reason: 'casual' });
    expect(onlineUnratedNotice('casual')).toContain('Casual');
  });
});

describe('onlineUnratedNotice', () => {
  it('explains advisor disqualification', () => {
    expect(onlineUnratedNotice('advisor_used')).toContain('advisor');
  });

  it('explains a guest participant', () => {
    expect(onlineUnratedNotice('unrated_participant')).toContain('guest');
  });

  it('falls back for unknown reasons', () => {
    expect(onlineUnratedNotice(undefined)).toBe('This sector was unrated.');
  });
});

describe('hasRatedHumanSector', () => {
  it('tracks idempotent game ids', () => {
    const doc = {
      uid: 'u1',
      displayName: 'A',
      matchesCompleted: 0,
      matchesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      totalPoints: 0,
      humanRatedGameIds: ['g1'],
      updatedAt: '',
    } satisfies PlayerStatsDocument;
    expect(hasRatedHumanSector(doc, 'g1')).toBe(true);
    expect(hasRatedHumanSector(doc, 'g2')).toBe(false);
  });
});
