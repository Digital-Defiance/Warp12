import { describe, expect, it } from 'vitest';
import type { GameLogEntry } from 'warp12-react';

import {
  COMMENTATOR_TICKER_MAX_LINES,
  filterGameLogLines,
  takeRecentLogLines,
} from './game-log-filter.js';

const names = { a: 'Armstrong', b: 'Lovell' };
const formatOptions = { roundStartedAtMs: Date.parse('2026-06-28T21:00:00.000Z') };

function entry(
  partial: Omit<GameLogEntry, 'effects'> & { effects?: GameLogEntry['effects'] }
): GameLogEntry {
  return { effects: [], ...partial };
}

describe('filterGameLogLines', () => {
  const entries: GameLogEntry[] = [
    entry({
      at: '2026-06-28T21:00:00.000Z',
      kind: 'ROUND_STARTED',
      captainId: 'a',
      roundNumber: 1,
      spacedockValue: 12,
    }),
    entry({
      at: '2026-06-28T21:00:10.000Z',
      kind: 'CHART_COORDINATE',
      captainId: 'a',
      coordinate: { low: 2, high: 4 },
      route: { kind: 'warp-trail', trailCaptainId: 'a' },
    }),
    entry({
      at: '2026-06-28T21:00:20.000Z',
      kind: 'CHART_COORDINATE',
      captainId: 'b',
      coordinate: { low: 0, high: 0 },
      route: { kind: 'neutral-zone', neutralZone: true },
      effects: ['continuum-flash-pending'],
    }),
    entry({
      at: '2026-06-28T21:01:00.000Z',
      kind: 'ALL_STOP',
      captainId: 'a',
    }),
  ];

  it('returns empty when silenced', () => {
    expect(
      filterGameLogLines({
        mode: 'off',
        entries,
        names,
        formatOptions,
      })
    ).toEqual([]);
  });

  it('keeps yourself + structural for mine', () => {
    const lines = filterGameLogLines({
      mode: 'mine',
      entries,
      names,
      formatOptions,
      humanCaptainId: 'a',
    });
    expect(lines.some((line) => line.includes('Lovell'))).toBe(false);
    expect(lines.some((line) => line.includes('Armstrong'))).toBe(true);
    expect(lines.some((line) => line.includes('Round 1'))).toBe(true);
  });

  it('digests to commentator highlights only', () => {
    const lines = filterGameLogLines({
      mode: 'commentator',
      entries,
      names,
      formatOptions,
    });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('underway');
    expect(lines[1]).toContain('Continuum Flash');
    expect(lines[2]).toContain('All Stop');
  });
});

describe('takeRecentLogLines', () => {
  it('keeps the newest N lines for stream feeds', () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(takeRecentLogLines(lines, COMMENTATOR_TICKER_MAX_LINES)).toEqual([
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
  });
});
