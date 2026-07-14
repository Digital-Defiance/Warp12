import { describe, expect, it } from 'vitest';
import type { GameState } from 'warp12-engine';
import { resolveHouseRules } from 'warp12-engine';

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
import type { PlayerStatsDocument, StoredRating } from './stats-schema.js';

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
    const ratingByUid = new Map<string, { rating: StoredRating; matches: number }>([
      ['u1', { rating: { mu: 32.0, sigma: 3.0, matches: 5, displayRating: 23.0, displayGrade: 'V23' }, matches: 5 }],
      ['u2', { rating: { mu: 28.0, sigma: 4.0, matches: 3, displayRating: 16.0, displayGrade: 'V16' }, matches: 3 }],
    ]);
    const table = buildHumanSectorRankTable(game, ['u1', 'u2'], ratingByUid);
    expect(table).toEqual([
      expect.objectContaining({ playerId: 'u1', rank: 1 }),
      expect.objectContaining({ playerId: 'u2', rank: 2 }),
    ]);
    expect(table?.[0]?.rating.mu).toBe(32.0);
    expect(table?.[1]?.rating.mu).toBe(28.0);
  });
  
  it('handles ties in score (same rank)', () => {
    const game = completePointsGame({ u1: 20, u2: 20, u3: 30 });
    const ratingByUid = new Map<string, { rating: StoredRating; matches: number }>([
      ['u1', { rating: { mu: 30.0, sigma: 3.0, matches: 10, displayRating: 21.0, displayGrade: 'V21' }, matches: 10 }],
      ['u2', { rating: { mu: 28.0, sigma: 3.5, matches: 8, displayRating: 17.5, displayGrade: 'V17' }, matches: 8 }],
      ['u3', { rating: { mu: 26.0, sigma: 4.0, matches: 5, displayRating: 14.0, displayGrade: 'V14' }, matches: 5 }],
    ]);
    const table = buildHumanSectorRankTable(game, ['u1', 'u2', 'u3'], ratingByUid);
    expect(table?.[0]?.rank).toBe(1);
    expect(table?.[1]?.rank).toBe(1); // Tied with u1
    expect(table?.[2]?.rank).toBe(3); // u3 gets rank 3 (not 2)
  });
});

describe('applyHumanTeiSelfUpdate', () => {
  it('increases rating for winner vs weaker field', () => {
    const table = [
      { 
        playerId: 'u1', 
        rank: 1, 
        rating: { mu: 32.0, sigma: 3.0, matches: 10, displayRating: 23.0, displayGrade: 'V23' },
        matches: 10,
      },
      { 
        playerId: 'u2', 
        rank: 2, 
        rating: { mu: 26.0, sigma: 4.0, matches: 8, displayRating: 14.0, displayGrade: 'V14' },
        matches: 8,
      },
    ];
    const doc: PlayerStatsDocument = {
      uid: 'u1',
      displayName: 'U1',
      matchesCompleted: 10,
      matchesWon: 5,
      roundsPlayed: 50,
      roundsWon: 25,
      totalPoints: 300,
      humanRating: {
        points: {
          rating: { mu: 32.0, sigma: 3.0, matches: 10, displayRating: 23.0, displayGrade: 'V23' },
          wins: 5,
        },
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    
    const result = applyHumanTeiSelfUpdate(doc, 'points', table, 'u1');
    expect(result?.update.won).toBe(true);
    expect(result?.update.rank).toBe(1);
    // Rating should increase (beat weaker opponent)
    expect(result?.update.ratingAfter.mu).toBeGreaterThan(result!.update.ratingBefore.mu);
    // Sigma should decrease slightly (more confidence)
    expect(result?.update.ratingAfter.sigma).toBeLessThan(result!.update.ratingBefore.sigma);
    // Matches should increment
    expect(result?.update.ratingAfter.matches).toBe(11);
  });
  
  it('decreases rating for loser vs stronger field', () => {
    const table = [
      { 
        playerId: 'u1', 
        rank: 1, 
        rating: { mu: 35.0, sigma: 2.5, matches: 20, displayRating: 27.5, displayGrade: 'V27' },
        matches: 20,
      },
      { 
        playerId: 'u2', 
        rank: 2, 
        rating: { mu: 28.0, sigma: 3.5, matches: 8, displayRating: 17.5, displayGrade: 'V17' },
        matches: 8,
      },
    ];
    const doc: PlayerStatsDocument = {
      uid: 'u2',
      displayName: 'U2',
      matchesCompleted: 8,
      matchesWon: 3,
      roundsPlayed: 40,
      roundsWon: 15,
      totalPoints: 400,
      humanRating: {
        points: {
          rating: { mu: 28.0, sigma: 3.5, matches: 8, displayRating: 17.5, displayGrade: 'V17' },
          wins: 3,
        },
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    
    const result = applyHumanTeiSelfUpdate(doc, 'points', table, 'u2');
    expect(result?.update.won).toBe(false);
    expect(result?.update.rank).toBe(2);
    // Rating should decrease (lost to stronger opponent)
    expect(result?.update.ratingAfter.mu).toBeLessThan(result!.update.ratingBefore.mu);
    // But not by much (expected to lose)
    expect(result!.update.ratingBefore.mu - result!.update.ratingAfter.mu).toBeLessThan(2.0);
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

  it('rejects Warped modules; allows calibrated Module Zeta squadrons', () => {
    const captains = [verifiedHuman('u1'), verifiedHuman('u2')];
    expect(
      onlineMatchRatingEligibility(captains, 'points', true, 12, {
        drafting: true,
      }).reason
    ).toBe('warped_modules');
    expect(
      onlineMatchRatingEligibility(captains, 'points', true, 12, {
        squadrons: true,
      }).rated
    ).toBe(true);
  });

  it('rates verified humans anchored against Ensign–Commander AI', () => {
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

  it('rates sectors that include Commander (neural Ω) AI', () => {
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
