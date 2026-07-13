import { describe, expect, it } from 'vitest';

import {
  applyGroupTeiForPlayer,
  charterMatchesRatedEvent,
  groupObjectiveTeiStats,
} from './apply-group-tei.js';
import type { TeiRankedPlayer } from './stats-openskill.js';

const table: TeiRankedPlayer[] = [
  { playerId: 'a', rank: 1, tei: 1000, unassistedMatches: 0 },
  { playerId: 'b', rank: 2, tei: 1000, unassistedMatches: 0 },
];

describe('applyGroupTeiForPlayer', () => {
  it('updates scoped crew TEI for a winner', () => {
    const applied = applyGroupTeiForPlayer(null, 'crew-1', 'points', table, 'a');
    expect(applied).not.toBeNull();
    expect(applied!.won).toBe(true);
    expect(applied!.teiAfter).toBeGreaterThan(applied!.teiBefore);
    expect(groupObjectiveTeiStats(
      { groupTei: applied!.groupTei },
      'crew-1',
      'points'
    ).unassistedMatches).toBe(1);
  });

  it('scopes updates to the charter bucket only', () => {
    const existing = {
      groupTei: {
        'other-crew': {
          points: { unassistedMatches: 9, unassistedWins: 4, unassistedTei: 1300 },
        },
      },
    };
    const applied = applyGroupTeiForPlayer(
      existing as import('./rated-match-schema.js').PlayerStatsDocument,
      'crew-1',
      'points',
      table,
      'b'
    );
    expect(applied!.groupTei['other-crew']?.points?.unassistedMatches).toBe(9);
    expect(applied!.groupTei['crew-1']?.points?.unassistedMatches).toBe(1);
  });

  it('ignores stale season buckets after a soft reset', () => {
    const existing = {
      groupTei: {
        'crew-1': {
          seasonKey: '2026-spring',
          points: { unassistedMatches: 5, unassistedWins: 3, unassistedTei: 1300 },
        },
      },
    };
    const fresh = groupObjectiveTeiStats(
      existing as import('./rated-match-schema.js').PlayerStatsDocument,
      'crew-1',
      'points',
      '2026-fall'
    );
    expect(fresh.unassistedMatches).toBe(0);

    const applied = applyGroupTeiForPlayer(
      existing as import('./rated-match-schema.js').PlayerStatsDocument,
      'crew-1',
      'points',
      table,
      'a',
      '2026-fall'
    );
    expect(applied!.teiBefore).toBe(1000);
    expect(applied!.groupTei['crew-1']?.seasonKey).toBe('2026-fall');
    expect(applied!.groupTei['crew-1']?.points?.unassistedMatches).toBe(1);
  });
});

describe('charterMatchesRatedEvent', () => {
  const charter = {
    objective: 'points' as const,
    playerCount: 4,
    rulesProfileId: 'warp12-official-v1',
    campaignRounds: 13,
  };

  it('accepts matching sector settings', () => {
    expect(
      charterMatchesRatedEvent(charter, {
        ...charter,
      })
    ).toBe(true);
  });

  it('rejects fleet size mismatch', () => {
    expect(
      charterMatchesRatedEvent(charter, {
        ...charter,
        playerCount: 6,
      })
    ).toBe(false);
  });

  it('rejects module drift', () => {
    expect(
      charterMatchesRatedEvent(charter, {
        ...charter,
        modules: { ...charter.modules!, subspaceFracture: true },
      })
    ).toBe(false);
  });
});
