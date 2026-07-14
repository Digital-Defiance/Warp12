import { describe, expect, it } from 'vitest';
import { updateTeamRatings, updateTwoTeamMatch, type Team } from './update-team.js';
import type { PlayerRating } from './types.js';

const DEFAULT: PlayerRating = { mu: 25, sigma: 8.33, matches: 0 };

describe('updateTeamRatings', () => {
  it('updates every member individually, not by averaging the team', () => {
    // Squad-1 (winner): alice is a strong veteran prior, bob is a fresh default.
    // If the implementation collapsed the team into one shared rating before
    // calling OpenSkill, alice and bob would end up with identical posteriors.
    // OpenSkill's per-individual credit means they must NOT match.
    const alice: PlayerRating = { mu: 35, sigma: 2, matches: 100 };
    const bob: PlayerRating = { ...DEFAULT };

    const teams: Team[] = [
      {
        teamId: 'squad-1',
        members: [
          { playerId: 'alice', rating: alice },
          { playerId: 'bob', rating: bob },
        ],
        rank: 1,
      },
      {
        teamId: 'squad-2',
        members: [
          { playerId: 'carol', rating: { ...DEFAULT } },
          { playerId: 'dave', rating: { ...DEFAULT } },
        ],
        rank: 2,
      },
    ];

    const updated = updateTeamRatings(teams);
    const aliceAfter = updated.get('alice')!;
    const bobAfter = updated.get('bob')!;

    // Different priors → different posteriors within the same (winning) squad.
    expect(aliceAfter.mu).not.toBeCloseTo(bobAfter.mu, 5);
    expect(aliceAfter.sigma).not.toBeCloseTo(bobAfter.sigma, 5);

    // Both squadmates still gained ground on the winning side.
    expect(aliceAfter.mu).toBeGreaterThan(alice.mu);
    expect(bobAfter.mu).toBeGreaterThan(bob.mu);
  });

  it('gives a lower-rated member a larger mu swing than a higher-rated teammate on the same win', () => {
    // A big upset win should move the uncertain/weaker member's estimate more
    // than the already-confident stronger member's — per-individual, not
    // team-averaged, credit assignment.
    const veteran: PlayerRating = { mu: 40, sigma: 1, matches: 300 };
    const newcomer: PlayerRating = { ...DEFAULT };

    const teams: Team[] = [
      {
        teamId: 'squad-1',
        members: [
          { playerId: 'veteran', rating: veteran },
          { playerId: 'newcomer', rating: newcomer },
        ],
        rank: 1,
      },
      {
        teamId: 'squad-2',
        members: [
          { playerId: 'opp1', rating: { ...DEFAULT } },
          { playerId: 'opp2', rating: { ...DEFAULT } },
        ],
        rank: 2,
      },
    ];

    const updated = updateTeamRatings(teams);
    const veteranDelta = updated.get('veteran')!.mu - veteran.mu;
    const newcomerDelta = updated.get('newcomer')!.mu - newcomer.mu;

    expect(newcomerDelta).toBeGreaterThan(veteranDelta);
  });

  it('moves winning-squad members up and losing-squad members down', () => {
    const teams: Team[] = [
      {
        teamId: 'squad-1',
        members: [
          { playerId: 'a', rating: { ...DEFAULT } },
          { playerId: 'c', rating: { ...DEFAULT } },
        ],
        rank: 1,
      },
      {
        teamId: 'squad-2',
        members: [
          { playerId: 'b', rating: { ...DEFAULT } },
          { playerId: 'd', rating: { ...DEFAULT } },
        ],
        rank: 2,
      },
    ];

    const updated = updateTeamRatings(teams);
    expect(updated.get('a')!.mu).toBeGreaterThan(DEFAULT.mu);
    expect(updated.get('c')!.mu).toBeGreaterThan(DEFAULT.mu);
    expect(updated.get('b')!.mu).toBeLessThan(DEFAULT.mu);
    expect(updated.get('d')!.mu).toBeLessThan(DEFAULT.mu);

    // Symmetric priors on each side → symmetric posteriors on each side.
    expect(updated.get('a')!.mu).toBeCloseTo(updated.get('c')!.mu, 10);
    expect(updated.get('b')!.mu).toBeCloseTo(updated.get('d')!.mu, 10);
  });

  it('decreases sigma (more confidence) for every participant', () => {
    const teams: Team[] = [
      {
        teamId: 'squad-1',
        members: [
          { playerId: 'a', rating: { ...DEFAULT } },
          { playerId: 'c', rating: { ...DEFAULT } },
        ],
        rank: 1,
      },
      {
        teamId: 'squad-2',
        members: [
          { playerId: 'b', rating: { ...DEFAULT } },
          { playerId: 'd', rating: { ...DEFAULT } },
        ],
        rank: 2,
      },
    ];

    const updated = updateTeamRatings(teams);
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(updated.get(id)!.sigma).toBeLessThan(DEFAULT.sigma);
    }
  });

  it('supports 3+ squads (multiplayer team ranks), each member updated individually', () => {
    const teams: Team[] = [
      {
        teamId: 'squad-1',
        members: [
          { playerId: 'a', rating: { ...DEFAULT } },
          { playerId: 'b', rating: { ...DEFAULT } },
        ],
        rank: 1,
      },
      {
        teamId: 'squad-2',
        members: [
          { playerId: 'c', rating: { ...DEFAULT } },
          { playerId: 'd', rating: { ...DEFAULT } },
        ],
        rank: 2,
      },
      {
        teamId: 'squad-3',
        members: [
          { playerId: 'e', rating: { ...DEFAULT } },
          { playerId: 'f', rating: { ...DEFAULT } },
        ],
        rank: 3,
      },
    ];

    const updated = updateTeamRatings(teams);
    expect(updated.size).toBe(6);
    // Monotonic by rank: 1st squad gains the most, 3rd loses the most.
    expect(updated.get('a')!.mu).toBeGreaterThan(updated.get('c')!.mu);
    expect(updated.get('c')!.mu).toBeGreaterThan(updated.get('e')!.mu);
  });

  it('supports 3-per-squad rosters', () => {
    const teams: Team[] = [
      {
        teamId: 'squad-1',
        members: [
          { playerId: 'a', rating: { ...DEFAULT } },
          { playerId: 'c', rating: { ...DEFAULT } },
          { playerId: 'e', rating: { ...DEFAULT } },
        ],
        rank: 1,
      },
      {
        teamId: 'squad-2',
        members: [
          { playerId: 'b', rating: { ...DEFAULT } },
          { playerId: 'd', rating: { ...DEFAULT } },
          { playerId: 'f', rating: { ...DEFAULT } },
        ],
        rank: 2,
      },
    ];

    const updated = updateTeamRatings(teams);
    expect(updated.size).toBe(6);
    for (const id of ['a', 'c', 'e']) {
      expect(updated.get(id)!.mu).toBeGreaterThan(DEFAULT.mu);
    }
    for (const id of ['b', 'd', 'f']) {
      expect(updated.get(id)!.mu).toBeLessThan(DEFAULT.mu);
    }
  });

  it('increments matches for every member', () => {
    const teams: Team[] = [
      {
        teamId: 'squad-1',
        members: [{ playerId: 'a', rating: { mu: 25, sigma: 8.33, matches: 5 } }],
        rank: 1,
      },
      {
        teamId: 'squad-2',
        members: [{ playerId: 'b', rating: { mu: 25, sigma: 8.33, matches: 12 } }],
        rank: 2,
      },
    ];
    const updated = updateTeamRatings(teams);
    expect(updated.get('a')!.matches).toBe(6);
    expect(updated.get('b')!.matches).toBe(13);
  });

  it('throws for a team with no members', () => {
    const teams: Team[] = [
      { teamId: 'squad-1', members: [], rank: 1 },
      {
        teamId: 'squad-2',
        members: [{ playerId: 'b', rating: { ...DEFAULT } }],
        rank: 2,
      },
    ];
    expect(() => updateTeamRatings(teams)).toThrow();
  });

  it('returns an empty map for no teams', () => {
    expect(updateTeamRatings([]).size).toBe(0);
  });
});

describe('updateTwoTeamMatch', () => {
  it('is a convenience wrapper equivalent to rank 1 / rank 2 teams', () => {
    const winning = {
      teamId: 'squad-1',
      members: [{ playerId: 'a', rating: { ...DEFAULT } }],
    };
    const losing = {
      teamId: 'squad-2',
      members: [{ playerId: 'b', rating: { ...DEFAULT } }],
    };

    const viaConvenience = updateTwoTeamMatch(winning, losing);
    const viaExplicit = updateTeamRatings([
      { ...winning, rank: 1 },
      { ...losing, rank: 2 },
    ]);

    expect(viaConvenience.get('a')).toEqual(viaExplicit.get('a'));
    expect(viaConvenience.get('b')).toEqual(viaExplicit.get('b'));
  });
});
