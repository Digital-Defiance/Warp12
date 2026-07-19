import { describe, expect, it } from 'vitest';

import {
  formatModuleFeedbackFromLogEntry,
  formatSpoolFeedback,
} from './module-feedback.js';
import type { GameLogEntry } from 'warp12-react';

const names = { a: 'Alice', b: 'Bob' };

describe('module-feedback spool abort copy', () => {
  it('formats viewer spool abort with retrieve / no Red Alert', () => {
    const entry: GameLogEntry = {
      at: '2026-07-18T12:00:00.000Z',
      kind: 'SPOOL_WARP_DRIVE',
      captainId: 'a',
      effects: ['spool-abort-retrieve'],
      spoolDetails: {
        tilesPlayed: 2,
        tilesToHand: 2,
        abortedUnfinishedDouble: true,
      },
    };
    expect(formatModuleFeedbackFromLogEntry(entry, names, 'a')).toBe(
      'Spooled 2 tiles — unfinished double retrieved to hand — no Red Alert'
    );
    expect(formatModuleFeedbackFromLogEntry(entry, names, 'b')).toBe(
      'Alice spooled 2 tiles — unfinished double retrieved — no Red Alert'
    );
  });

  it('formats spool mismatch without abort phrasing', () => {
    const entry: GameLogEntry = {
      at: '2026-07-18T12:00:00.000Z',
      kind: 'SPOOL_WARP_DRIVE',
      captainId: 'a',
      effects: [],
      spoolDetails: { tilesPlayed: 3, tilesToHand: 1 },
    };
    expect(formatModuleFeedbackFromLogEntry(entry, names, 'a')).toBe(
      'Spooled 3 tiles — drew 1 mismatch to hand'
    );
  });

  it('formatSpoolFeedback prefers abort pulse over mismatch count', () => {
    const entry: GameLogEntry = {
      at: '2026-07-18T12:00:00.000Z',
      kind: 'SPOOL_WARP_DRIVE',
      captainId: 'a',
      effects: ['spool-abort-retrieve'],
      spoolDetails: {
        tilesPlayed: 1,
        tilesToHand: 2,
        abortedUnfinishedDouble: true,
      },
    };
    expect(
      formatSpoolFeedback({
        before: { round: { hands: { a: [] } } } as never,
        after: {
          round: { hands: { a: [{ low: 1, high: 1 }, { low: 2, high: 3 }] } },
        } as never,
        action: {
          type: 'SPOOL_WARP_DRIVE',
          playerId: 'a',
          route: { kind: 'warp-trail', playerId: 'a' },
        },
        entry,
        names,
        viewerId: 'a',
      })
    ).toBe('Spooled 1 tile — unfinished double retrieved to hand — no Red Alert');
  });
});
