import { describe, expect, it } from 'vitest';
import { resolveHouseRules, type GameState } from 'warp12-engine';

import type { FirestoreCaptain } from './schema.js';
import {
  applyHumanTeiSelfUpdate,
  buildHumanSectorRankTable,
  hasRatedHumanSector,
  isHumanOnlySector,
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
      qContinuum: false,
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
