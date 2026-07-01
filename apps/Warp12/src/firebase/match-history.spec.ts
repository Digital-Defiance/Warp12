import { describe, expect, it } from 'vitest';

import {
  appendMatchHistory,
  MAX_MATCH_HISTORY,
  recentDecisionTrend,
  recentTeiTrend,
} from './match-history.js';
import type { MatchHistoryEntry } from './stats-schema.js';

const baseEntry = (overrides: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry => ({
  playedAt: Date.now(),
  objective: 'go-out',
  opponentSkill: 'lieutenant',
  won: true,
  advisorUsed: false,
  ...overrides,
});

describe('match-history', () => {
  it('caps history length', () => {
    let history: MatchHistoryEntry[] = [];
    for (let index = 0; index < MAX_MATCH_HISTORY + 5; index += 1) {
      history = appendMatchHistory(history, baseEntry({ playedAt: index }));
    }
    expect(history).toHaveLength(MAX_MATCH_HISTORY);
    expect(history[0]?.playedAt).toBe(MAX_MATCH_HISTORY + 4);
  });

  it('builds decision trend oldest-to-newest within the window', () => {
    const history = [
      baseEntry({ decisionPct: 90, playedAt: 3 }),
      baseEntry({ decisionPct: 70, playedAt: 2 }),
      baseEntry({ decisionPct: 80, playedAt: 1 }),
    ];
    expect(recentDecisionTrend(history)).toEqual([
      { label: '1', value: 80 },
      { label: '2', value: 70 },
      { label: '3', value: 90 },
    ]);
  });

  it('filters TEI trend to unassisted matches for the objective', () => {
    const history = [
      baseEntry({
        objective: 'go-out',
        teiAfter: 1200,
        advisorUsed: false,
        playedAt: 2,
      }),
      baseEntry({
        objective: 'go-out',
        teiAfter: 1180,
        advisorUsed: true,
        playedAt: 1,
      }),
      baseEntry({
        objective: 'points',
        teiAfter: 900,
        advisorUsed: false,
        playedAt: 0,
      }),
    ];
    expect(recentTeiTrend(history, 'go-out')).toEqual([
      { label: '1', value: 1200 },
    ]);
  });
});
