import { describe, expect, it } from 'vitest';
import { buildSquadMatchArchive } from './squad-match-archive.js';

describe('buildSquadMatchArchive', () => {
  it('records ranks, winners, and flat memberUids', () => {
    const ranks = new Map([
      ['squad-1', 1],
      ['squad-2', 2],
    ]);
    const doc = buildSquadMatchArchive({
      gameId: 'g1',
      playedAt: '2026-07-13T00:00:00.000Z',
      objective: 'points',
      captains: [
        { id: 'a', displayName: 'Alice' },
        { id: 'b', displayName: 'Bob' },
        { id: 'c', displayName: 'Carol' },
        { id: 'd', displayName: 'Dave' },
      ],
      squadrons: [
        { id: 'squad-1', memberIds: ['a', 'c'], name: 'Home' },
        { id: 'squad-2', memberIds: ['b', 'd'] },
      ],
      squadRanks: ranks,
    });
    expect(doc.rated).toBe(true);
    expect([...doc.memberUids].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(doc.winnerSquadIds).toEqual(['squad-1']);
    expect(doc.squadrons[0]).toMatchObject({
      name: 'Home',
      rank: 1,
      memberDisplayNames: ['Alice', 'Carol'],
    });
  });
});
