import { describe, expect, it } from 'vitest';

import { applyHumanTeiForPlayer, buildTeiTableFromStandings } from './apply-human-tei.js';
import type { RatedMatchDocument } from './rated-match-schema.js';
import type { TeiRankedPlayer } from './stats-elo.js';

const table: TeiRankedPlayer[] = [
  { playerId: 'a', rank: 1, tei: 1200, unassistedMatches: 5 },
  { playerId: 'b', rank: 2, tei: 1200, unassistedMatches: 5 },
];

describe('applyHumanTeiForPlayer', () => {
  it('bumps the winner on the human pool track', () => {
    const applied = applyHumanTeiForPlayer(null, 'points', table, 'a');
    expect(applied).not.toBeNull();
    expect(applied!.won).toBe(true);
    expect(applied!.teiAfter).toBeGreaterThan(applied!.teiBefore);
    expect(applied!.humanTei.points?.unassistedMatches).toBe(1);
  });
});

describe('buildTeiTableFromStandings', () => {
  it('maps match standings into ranked TEI rows', () => {
    const match: RatedMatchDocument = {
      matchCode: 'MT-ABCD',
      status: 'completed',
      objective: 'points',
      campaignRounds: 13,
      officialId: 'off',
      officialDisplayName: 'Official',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      participants: [],
      standings: [
        { uid: 'a', displayName: 'A', rank: 1, score: 10 },
        { uid: 'b', displayName: 'B', rank: 2, score: 20 },
      ],
    };

    const teiByUid = new Map([
      ['a', { tei: 1180, matches: 3 }],
      ['b', { tei: 1220, matches: 8 }],
    ]);

    const built = buildTeiTableFromStandings(match, teiByUid);
    expect(built).toEqual([
      { playerId: 'a', rank: 1, tei: 1180, unassistedMatches: 3 },
      { playerId: 'b', rank: 2, tei: 1220, unassistedMatches: 8 },
    ]);
  });
});
