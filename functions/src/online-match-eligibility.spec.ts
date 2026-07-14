import { describe, expect, it } from 'vitest';
import {
  aiSkill,
  computeOnlineRanks,
  computeOnlineSquadRanks,
  evaluateOnlineRatingEligibility,
  isAiGameCaptain,
  isSquadGame,
  type GameDoc,
} from './online-match-eligibility.js';

function baseGame(overrides: Partial<GameDoc> = {}): GameDoc {
  return {
    id: 'g1',
    phase: 'complete',
    objective: 'points',
    rated: true,
    maxPip: 12,
    captains: [
      { id: 'alice', displayName: 'Alice', pointsScore: 10 },
      { id: 'bob', displayName: 'Bob', pointsScore: 20 },
    ],
    ...overrides,
  };
}

describe('isAiGameCaptain / aiSkill', () => {
  it('detects AI captains by isAi flag or id prefix', () => {
    expect(isAiGameCaptain({ id: 'ai:commander-1', displayName: 'C', isAi: true })).toBe(true);
    expect(isAiGameCaptain({ id: 'ai:commander-1', displayName: 'C' })).toBe(true);
    expect(isAiGameCaptain({ id: 'alice', displayName: 'Alice' })).toBe(false);
  });

  it('defaults unknown/missing skill to lieutenant', () => {
    expect(aiSkill({ id: 'ai:1', displayName: 'AI', skill: 'commander' })).toBe('commander');
    expect(aiSkill({ id: 'ai:1', displayName: 'AI', skill: 'bogus' })).toBe('lieutenant');
    expect(aiSkill({ id: 'ai:1', displayName: 'AI' })).toBe('lieutenant');
  });
});

describe('isSquadGame', () => {
  it('is true only when the squadrons module is on and rosters exist', () => {
    expect(
      isSquadGame({ modules: { squadrons: true } as GameDoc['modules'], squadrons: [{ id: 's1', memberIds: ['a'] }] })
    ).toBe(true);
    expect(
      isSquadGame({ modules: { squadrons: true } as GameDoc['modules'], squadrons: [] })
    ).toBe(false);
    expect(isSquadGame({ modules: { squadrons: false } as GameDoc['modules'] })).toBe(false);
    expect(isSquadGame({})).toBe(false);
  });
});

describe('evaluateOnlineRatingEligibility', () => {
  it('rejects casual (rated: false) sectors', () => {
    expect(evaluateOnlineRatingEligibility(baseGame({ rated: false }))).toEqual({
      rated: false,
      reason: 'casual',
    });
  });

  it('rejects exhibition sets (maxPip !== 12)', () => {
    expect(evaluateOnlineRatingEligibility(baseGame({ maxPip: 15 }))).toEqual({
      rated: false,
      reason: 'exhibition_set',
    });
  });

  it('rejects non-rated objectives', () => {
    expect(
      evaluateOnlineRatingEligibility(baseGame({ objective: 'sandbox' }))
    ).toEqual({ rated: false, reason: 'objective_not_rated' });
  });

  it('rejects fewer than two humans', () => {
    expect(
      evaluateOnlineRatingEligibility(
        baseGame({
          captains: [
            { id: 'alice', displayName: 'Alice', pointsScore: 0 },
            { id: 'ai:1', displayName: 'AI', isAi: true, skill: 'commander' },
          ],
        })
      )
    ).toEqual({ rated: false, reason: 'not_enough_humans' });
  });

  it('rejects a Class I* AI seat', () => {
    expect(
      evaluateOnlineRatingEligibility(
        baseGame({
          captains: [
            { id: 'alice', displayName: 'Alice', pointsScore: 0 },
            { id: 'bob', displayName: 'Bob', pointsScore: 0 },
            { id: 'ai:1', displayName: 'AI', isAi: true, class1Star: true },
          ],
        })
      )
    ).toEqual({ rated: false, reason: 'class1_star_present' });
  });

  it('rejects an AI seat with an unrecognized skill key', () => {
    expect(
      evaluateOnlineRatingEligibility(
        baseGame({
          captains: [
            { id: 'alice', displayName: 'Alice', pointsScore: 0 },
            { id: 'bob', displayName: 'Bob', pointsScore: 0 },
            { id: 'ai:1', displayName: 'AI', isAi: true, skill: 'omega-plus' },
          ],
        })
      )
    ).toEqual({ rated: false, reason: 'unrated_ai' });
  });

  it('accepts an otherwise-eligible FFA sector', () => {
    expect(evaluateOnlineRatingEligibility(baseGame())).toEqual({ rated: true });
  });

  it('rejects Warped modules (Epsilon / Kappa / Lambda)', () => {
    expect(
      evaluateOnlineRatingEligibility(
        baseGame({ modules: { drafting: true } })
      )
    ).toEqual({ rated: false, reason: 'warped_modules' });
    expect(
      evaluateOnlineRatingEligibility(
        baseGame({ modules: { temporalInversion: true } })
      )
    ).toEqual({ rated: false, reason: 'warped_modules' });
    expect(
      evaluateOnlineRatingEligibility(
        baseGame({ modules: { wormholes: true } })
      )
    ).toEqual({ rated: false, reason: 'warped_modules' });
  });

  it('rates an otherwise-eligible squad sector when SQUADRONS_RATING_CALIBRATED', () => {
    const squadGame = baseGame({
      modules: {
        continuum: false,
        salamanderPenalty: false,
        subspaceFracture: false,
        subspaceFractureScope: 'own-trail',
        squadrons: true,
      },
      squadrons: [
        { id: 'squad-1', memberIds: ['alice'] },
        { id: 'squad-2', memberIds: ['bob'] },
      ],
    });
    // Squadron TEI writes go to squadRating (not FFA humanRating). Gate on.
    expect(evaluateOnlineRatingEligibility(squadGame)).toEqual({ rated: true });
  });
});

describe('computeOnlineRanks', () => {
  it('ranks points by ascending pointsScore (lower is better)', () => {
    const game = baseGame({
      captains: [
        { id: 'alice', displayName: 'Alice', pointsScore: 42 },
        { id: 'bob', displayName: 'Bob', pointsScore: 10 },
        { id: 'carol', displayName: 'Carol', pointsScore: 42 },
      ],
    });
    const ranks = computeOnlineRanks(game);
    expect(ranks.get('bob')).toBe(1);
    expect(ranks.get('alice')).toBe(2);
    expect(ranks.get('carol')).toBe(2); // tie shares rank
  });

  it('ranks go-out by winner first, then fewest remaining tiles', () => {
    const game = baseGame({
      objective: 'go-out',
      captains: [
        { id: 'alice', displayName: 'Alice' },
        { id: 'bob', displayName: 'Bob' },
        { id: 'carol', displayName: 'Carol' },
      ],
      round: {
        roundWinnerId: 'bob',
        handCounts: { alice: 3, carol: 1 },
      },
    });
    const ranks = computeOnlineRanks(game);
    expect(ranks.get('bob')).toBe(1);
    expect(ranks.get('carol')).toBe(2);
    expect(ranks.get('alice')).toBe(3);
  });
});

describe('computeOnlineSquadRanks', () => {
  it('ranks squads by aggregate points score (each member already carries the squad total)', () => {
    const game = baseGame({
      objective: 'points',
      captains: [
        { id: 'alice', displayName: 'Alice', pointsScore: 0 },
        { id: 'carol', displayName: 'Carol', pointsScore: 0 },
        { id: 'bob', displayName: 'Bob', pointsScore: 24 },
        { id: 'dave', displayName: 'Dave', pointsScore: 24 },
      ],
      squadrons: [
        { id: 'squad-1', memberIds: ['alice', 'carol'] },
        { id: 'squad-2', memberIds: ['bob', 'dave'] },
      ],
    });
    const ranks = computeOnlineSquadRanks(game);
    expect(ranks.get('squad-1')).toBe(1);
    expect(ranks.get('squad-2')).toBe(2);
  });

  it('ranks squads for go-out with the winner squad sorting first', () => {
    const game = baseGame({
      objective: 'go-out',
      captains: [
        { id: 'alice', displayName: 'Alice' },
        { id: 'carol', displayName: 'Carol' },
        { id: 'bob', displayName: 'Bob' },
        { id: 'dave', displayName: 'Dave' },
      ],
      round: {
        roundWinnerId: 'carol',
        handCounts: { alice: 2, bob: 5, dave: 5 },
      },
      squadrons: [
        { id: 'squad-1', memberIds: ['alice', 'carol'] },
        { id: 'squad-2', memberIds: ['bob', 'dave'] },
      ],
    });
    const ranks = computeOnlineSquadRanks(game);
    expect(ranks.get('squad-1')).toBe(1); // carol went out
    expect(ranks.get('squad-2')).toBe(2);
  });
});
