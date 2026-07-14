import { describe, expect, it } from 'vitest';
import { applySquadRatingForPlayer, buildSquadRatingTable } from './apply-squad-tei.js';
import type { PlayerStatsDocument, StoredRating } from './rated-match-schema.js';

const DEFAULT_RATING: StoredRating = {
  mu: 25.0,
  sigma: 25.0 / 3,
  matches: 0,
  displayRating: 0.0,
};

function statsWithSquadRating(
  uid: string,
  rating: StoredRating,
  matches = rating.matches
): PlayerStatsDocument {
  return {
    uid,
    displayName: uid,
    matchesCompleted: matches,
    matchesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    totalPoints: 0,
    squadRating: { points: { rating, wins: 0 } },
    updatedAt: new Date().toISOString(),
  };
}

describe('buildSquadRatingTable', () => {
  it('flattens squad rosters into per-player rows with the right rank', () => {
    const table = buildSquadRatingTable(
      [
        { squadId: 'squad-1', memberIds: ['alice', 'carol'], rank: 1 },
        { squadId: 'squad-2', memberIds: ['bob', 'dave'], rank: 2 },
      ],
      new Map([
        ['alice', { ...DEFAULT_RATING, mu: 30 }],
        ['carol', DEFAULT_RATING],
        ['bob', DEFAULT_RATING],
        ['dave', DEFAULT_RATING],
      ])
    );

    expect(table).toHaveLength(4);
    expect(table.find((p) => p.playerId === 'alice')).toMatchObject({
      squadId: 'squad-1',
      rank: 1,
      rating: { mu: 30 },
    });
    expect(table.find((p) => p.playerId === 'bob')).toMatchObject({
      squadId: 'squad-2',
      rank: 2,
    });
  });

  it('falls back to default rating for players missing from the map', () => {
    const table = buildSquadRatingTable(
      [{ squadId: 'squad-1', memberIds: ['alice'], rank: 1 }],
      new Map()
    );
    expect(table[0].rating).toEqual(DEFAULT_RATING);
  });
});

describe('applySquadRatingForPlayer', () => {
  it('rates the winning squad member up and the losing squad member down', () => {
    const table = buildSquadRatingTable(
      [
        { squadId: 'squad-1', memberIds: ['alice', 'carol'], rank: 1 },
        { squadId: 'squad-2', memberIds: ['bob', 'dave'], rank: 2 },
      ],
      new Map([
        ['alice', DEFAULT_RATING],
        ['carol', DEFAULT_RATING],
        ['bob', DEFAULT_RATING],
        ['dave', DEFAULT_RATING],
      ])
    );

    const aliceResult = applySquadRatingForPlayer(null, 'points', table, 'alice');
    const bobResult = applySquadRatingForPlayer(null, 'points', table, 'bob');

    expect(aliceResult).not.toBeNull();
    expect(bobResult).not.toBeNull();
    expect(aliceResult!.won).toBe(true);
    expect(aliceResult!.rank).toBe(1);
    expect(aliceResult!.squadId).toBe('squad-1');
    expect(aliceResult!.ratingAfter.mu).toBeGreaterThan(aliceResult!.ratingBefore.mu);

    expect(bobResult!.won).toBe(false);
    expect(bobResult!.rank).toBe(2);
    expect(bobResult!.squadId).toBe('squad-2');
    expect(bobResult!.ratingAfter.mu).toBeLessThan(bobResult!.ratingBefore.mu);
  });

  it('reads the player\'s OWN prior rating from Firestore, not a squad average', () => {
    // alice is a strong veteran; her squadmate carol is brand new. Both are on
    // the winning squad. If the wiring collapsed the team into an average
    // before rating, alice and carol would get identical deltas — they must
    // not, because OpenSkill assigns credit per individual within a team.
    const table = buildSquadRatingTable(
      [
        { squadId: 'squad-1', memberIds: ['alice', 'carol'], rank: 1 },
        { squadId: 'squad-2', memberIds: ['bob', 'dave'], rank: 2 },
      ],
      new Map([
        ['alice', { mu: 35, sigma: 2, matches: 100, displayRating: 29 }],
        ['carol', DEFAULT_RATING],
        ['bob', DEFAULT_RATING],
        ['dave', DEFAULT_RATING],
      ])
    );

    const aliceDoc = statsWithSquadRating('alice', {
      mu: 35,
      sigma: 2,
      matches: 100,
      displayRating: 29,
    });
    const carolDoc = statsWithSquadRating('carol', DEFAULT_RATING);

    const aliceResult = applySquadRatingForPlayer(aliceDoc, 'points', table, 'alice');
    const carolResult = applySquadRatingForPlayer(carolDoc, 'points', table, 'carol');

    expect(aliceResult).not.toBeNull();
    expect(carolResult).not.toBeNull();
    expect(aliceResult!.ratingBefore.mu).toBe(35);
    expect(carolResult!.ratingBefore.mu).toBe(25);
    // Different priors → different posteriors, even on the same winning squad.
    expect(aliceResult!.ratingAfter.mu).not.toBeCloseTo(carolResult!.ratingAfter.mu, 5);
  });

  it('increments matches and preserves prior wins', () => {
    const table = buildSquadRatingTable(
      [
        { squadId: 'squad-1', memberIds: ['alice'], rank: 1 },
        { squadId: 'squad-2', memberIds: ['bob'], rank: 2 },
      ],
      new Map([
        ['alice', { mu: 25, sigma: 8.33, matches: 5, displayRating: 0 }],
        ['bob', DEFAULT_RATING],
      ])
    );
    const doc = statsWithSquadRating(
      'alice',
      { mu: 25, sigma: 8.33, matches: 5, displayRating: 0 },
      5
    );
    (doc.squadRating!.points as { wins: number }).wins = 3;

    const result = applySquadRatingForPlayer(doc, 'points', table, 'alice');
    expect(result).not.toBeNull();
    expect(result!.ratingAfter.matches).toBe(6);
    expect(result!.squadRating.points?.wins).toBe(4); // 3 prior + this win
  });

  it('returns null for a player not on the table', () => {
    const table = buildSquadRatingTable(
      [{ squadId: 'squad-1', memberIds: ['alice'], rank: 1 }],
      new Map()
    );
    expect(applySquadRatingForPlayer(null, 'points', table, 'zed')).toBeNull();
  });

  it('uses the go-out objective track independently of points', () => {
    const table = buildSquadRatingTable(
      [
        { squadId: 'squad-1', memberIds: ['alice'], rank: 1 },
        { squadId: 'squad-2', memberIds: ['bob'], rank: 2 },
      ],
      new Map([
        ['alice', DEFAULT_RATING],
        ['bob', DEFAULT_RATING],
      ])
    );
    const result = applySquadRatingForPlayer(null, 'go-out', table, 'alice');
    expect(result).not.toBeNull();
    expect(result!.squadRating.goOut).toBeDefined();
    expect(result!.squadRating.points).toBeUndefined();
  });
});
