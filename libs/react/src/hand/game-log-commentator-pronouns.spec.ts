import { describe, expect, it } from 'vitest';

import { formatCommentatorLine } from './game-log-commentator.js';
import type { GameLogEntry } from './game-log.js';
import { HE_PRONOUNS, SHE_PRONOUNS } from './pronouns.js';

const formatOptions = {
  roundStartedAtMs: Date.parse('2026-06-28T21:00:00.000Z'),
};

describe('commentator pronouns', () => {
  it('uses she/her on own trail and keeps verb agreement', () => {
    const entry = {
      at: '2026-06-28T21:01:00.000Z',
      kind: 'SPOOL_WARP_DRIVE',
      captainId: 'armstrong',
      route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
      spoolDetails: { tilesPlayed: 2, tilesToHand: 1 },
      effects: ['trail-momentum-claimed'],
    } as GameLogEntry;

    const line = formatCommentatorLine(
      entry,
      { armstrong: 'Armstrong' },
      {
        ...formatOptions,
        pronouns: { armstrong: SHE_PRONOUNS },
      }
    );
    expect(line).toContain('on her own Trail');
    expect(line).toContain('she keeps the conn');
  });

  it('defaults to they/their when pronouns are omitted', () => {
    const entry = {
      at: '2026-06-28T21:01:00.000Z',
      kind: 'SPOOL_WARP_DRIVE',
      captainId: 'armstrong',
      route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
      spoolDetails: { tilesPlayed: 1, tilesToHand: 0 },
      effects: [],
    } as GameLogEntry;

    const line = formatCommentatorLine(
      entry,
      { armstrong: 'Armstrong' },
      formatOptions
    );
    expect(line).toContain('on their own Trail');
  });

  it('uses his for he/him preference', () => {
    const entry = {
      at: '2026-06-28T21:01:00.000Z',
      kind: 'SPOOL_WARP_DRIVE',
      captainId: 'lovell',
      route: {
        kind: 'warp-trail',
        trailCaptainId: 'lovell',
        squadronTrail: true,
      },
      spoolDetails: { tilesPlayed: 1, tilesToHand: 0 },
      effects: [],
    } as GameLogEntry;

    const line = formatCommentatorLine(
      entry,
      { lovell: 'Lovell' },
      {
        ...formatOptions,
        pronouns: { lovell: HE_PRONOUNS },
      }
    );
    expect(line).toContain('on his squadron Trail');
  });
});
