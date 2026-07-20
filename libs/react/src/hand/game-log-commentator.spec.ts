import { describe, expect, it } from 'vitest';
import { applyAction, formSquadrons, resolveModules } from 'warp12-engine';

import type { GameLogEntry } from './game-log.js';
import {
  buildGameLogEntry,
  buildModuleLoadoutEntry,
} from './game-log.js';
import {
  COMMENTATOR_BANNED_PHRASES,
  commentatorLineIsSane,
  formatCommentatorLine,
  formatCommentatorLogLines,
  isCommentatorHighlight,
} from './game-log-commentator.js';
import {
  makeGame,
  makeRound,
  placed,
  T,
} from '../../../engine/src/lib/engine/test-helpers.js';
import { createInitialTable } from '../../../engine/src/lib/table/table-state.js';

const names = {
  armstrong: 'Armstrong',
  lovell: 'Lovell',
  earhart: 'Earhart',
};

const formatOptions = {
  roundStartedAtMs: Date.parse('2026-06-28T21:00:00.000Z'),
};

function entry(
  partial: Omit<GameLogEntry, 'effects'> & {
    effects?: GameLogEntry['effects'];
  }
): GameLogEntry {
  return {
    effects: [],
    ...partial,
  };
}

describe('isCommentatorHighlight', () => {
  it('keeps structural sector beats', () => {
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:00:00.000Z',
          kind: 'ROUND_STARTED',
          captainId: 'armstrong',
          roundNumber: 1,
          spacedockValue: 12,
        })
      )
    ).toBe(true);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:00:00.000Z',
          kind: 'MODULE_LOADOUT',
          captainId: 'armstrong',
          moduleLabels: ['Alpha'],
        })
      )
    ).toBe(true);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:10:00.000Z',
          kind: 'END_ROUND',
          captainId: 'armstrong',
          winnerId: 'armstrong',
          effects: ['round-won'],
        })
      )
    ).toBe(true);
  });

  it('keeps ceremony and crisis actions', () => {
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:05:00.000Z',
          kind: 'ALL_STOP',
          captainId: 'armstrong',
        })
      )
    ).toBe(true);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:05:00.000Z',
          kind: 'SPOOL_WARP_DRIVE',
          captainId: 'lovell',
          route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
        })
      )
    ).toBe(true);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:05:00.000Z',
          kind: 'DEPLOY_DISTRESS_BEACON',
          captainId: 'earhart',
        })
      )
    ).toBe(true);
  });

  it('skips routine charts and draws', () => {
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:01:00.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'armstrong',
          coordinate: { low: 3, high: 9 },
          route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        })
      )
    ).toBe(false);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:01:00.000Z',
          kind: 'DRAW_FROM_UNCHARTED',
          captainId: 'lovell',
        })
      )
    ).toBe(false);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:01:00.000Z',
          kind: 'PASS_TURN',
          captainId: 'earhart',
        })
      )
    ).toBe(false);
  });

  it('keeps charts that open or clear alerts and module fireworks', () => {
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:02:00.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'armstrong',
          coordinate: { low: 5, high: 5 },
          route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
          effects: ['red-alert-opened'],
        })
      )
    ).toBe(true);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:02:00.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'lovell',
          coordinate: { low: 12, high: 0 },
          route: { kind: 'neutral-zone', neutralZone: true },
          hotPotato: { taken: true },
        })
      )
    ).toBe(true);
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:02:00.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'earhart',
          coordinate: { low: 8, high: 8 },
          route: { kind: 'warp-trail', trailCaptainId: 'earhart' },
          doubleDown: { targetCaptainId: 'armstrong', drawCount: 2 },
        })
      )
    ).toBe(true);
  });

  it('keeps Hot Potato pass penalties only', () => {
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:03:00.000Z',
          kind: 'PASS_TURN',
          captainId: 'armstrong',
          hotPotato: { passPenalty: true },
        })
      )
    ).toBe(true);
  });
});

describe('formatCommentatorLine', () => {
  it('returns empty for non-highlights', () => {
    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:01:00.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'armstrong',
          coordinate: { low: 3, high: 9 },
          route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        }),
        names,
        formatOptions
      )
    ).toBe('');
  });

  it('calls the first chart of the round as an opening', () => {
    const ownTrail = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:00:02.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 5, high: 12 },
        route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        effects: ['round-opened'],
      }),
      names,
      formatOptions
    );
    expect(ownTrail).toBe(
      '00:02 - Armstrong opens with a 5:12 on their own Trail!'
    );

    const neutral = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:00:02.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 12, high: 12 },
        route: { kind: 'neutral-zone' },
        effects: ['round-opened', 'caution-opened'],
      }),
      names,
      formatOptions
    );
    expect(neutral).toContain('Armstrong opens with Double 12-12 on the Neutral Zone!');
    expect(neutral).toContain('Yellow alert!');
  });

  it('calls the first Neutral Zone chart mid-round', () => {
    const line = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:03:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'lovell',
        coordinate: { low: 3, high: 12 },
        route: { kind: 'neutral-zone' },
        effects: ['neutral-zone-opened'],
      }),
      names,
      formatOptions
    );
    expect(line).toBe(
      '03:00 - Lovell opens the Neutral Zone with a 3:12!'
    );
  });

  it('calls All Stop with ringside energy', () => {
    const line = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:05:12.000Z',
        kind: 'ALL_STOP',
        captainId: 'armstrong',
      }),
      names,
      formatOptions
    );
    expect(line).toBe(
      '05:12 - All Stop! Armstrong empties the hand — what a finish!'
    );
  });

  it('omits the elapsed prefix when includeElapsedPrefix is false', () => {
    const line = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:05:12.000Z',
        kind: 'ALL_STOP',
        captainId: 'armstrong',
      }),
      names,
      { ...formatOptions, includeElapsedPrefix: false }
    );
    expect(line).toBe(
      'All Stop! Armstrong empties the hand — what a finish!'
    );
  });

  it('dramatizes Red Alert open and clear', () => {
    const opened = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:00:03.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 5, high: 5 },
        route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
        effects: ['red-alert-opened'],
      }),
      names,
      formatOptions
    );
    expect(opened).toContain('Armstrong charts Double 5-5');
    expect(opened).toContain('Red Alert');
    expect(opened).toContain("Captain Lovell's Trail");

    const cleared = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:01:45.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 12, high: 7 },
        route: { kind: 'red-alert-cover', trailCaptainId: 'lovell' },
        effects: ['red-alert-cleared'],
      }),
      names,
      formatOptions
    );
    expect(cleared).toContain('Earhart charts 12:7');
    expect(cleared).toContain('Red Alert is answered');
  });

  it('calls Continuum Flash and warp drive', () => {
    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:04:00.000Z',
          kind: 'INVOKE_CONTINUUM_FLASH',
          captainId: 'lovell',
          flashEffect: 'pip-shift',
        }),
        names,
        formatOptions
      )
    ).toBe('04:00 - Continuum Flash! Lovell invokes pip shift!');

    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:04:30.000Z',
          kind: 'SPOOL_WARP_DRIVE',
          captainId: 'armstrong',
          route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
          spoolDetails: { tilesPlayed: 3, tilesToHand: 1 },
        }),
        names,
        formatOptions
      )
    ).toBe(
      '04:30 - Armstrong engages warp drive on their own Trail (3 tiles away, 1 to hand)!'
    );
  });

  it('narrates inverted Kappa round ends without crude phrasing', () => {
    const line = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:20:00.000Z',
        kind: 'END_ROUND',
        captainId: 'armstrong',
        winnerId: 'armstrong',
        roundInverted: true,
        roundWinnerIds: ['lovell'],
        effects: ['round-won'],
      }),
      names,
      formatOptions
    );
    expect(line).toBe(
      '20:00 - Inverted round! Armstrong goes out — maximum penalty! Lovell takes the round with the heaviest hand!'
    );
  });

  it('narrates Double Down and Salamander Surge cleanly', () => {
    const doubleDown = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:06:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 8, high: 8 },
        route: { kind: 'warp-trail', trailCaptainId: 'earhart' },
        doubleDown: { targetCaptainId: 'armstrong', drawCount: 2 },
      }),
      names,
      formatOptions
    );
    expect(doubleDown).toContain('Double Down! Armstrong draws 2!');

    const surge = formatCommentatorLine(
      entry({
        at: '2026-06-28T21:06:30.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'lovell',
        coordinate: { low: 12, high: 12 },
        route: { kind: 'neutral-zone', neutralZone: true },
        salamanderSurge: { opponentDraws: 3 },
      }),
      names,
      formatOptions
    );
    expect(surge).toContain('Salamander Surge! The fleet draws 3!');
  });

  it('uses federation terms for beacon and shields', () => {
    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:07:00.000Z',
          kind: 'DEPLOY_DISTRESS_BEACON',
          captainId: 'armstrong',
        }),
        names,
        formatOptions
      )
    ).toMatch(
      /^07:00 - Armstrong (puts up their Distress Beacon|lowers their shields) — trail open!$/
    );
    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:07:10.000Z',
          kind: 'RAISE_SHIELDS',
          captainId: 'lovell',
        }),
        names,
        formatOptions
      )
    ).toMatch(
      /^07:10 - Lovell (raises their shields|takes down their Distress Beacon) — trail secured!$/
    );
  });

  it('handles Hot Potato pass as points, not slang', () => {
    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:08:00.000Z',
          kind: 'PASS_TURN',
          captainId: 'earhart',
          hotPotato: { passPenalty: true },
        }),
        names,
        formatOptions
      )
    ).toBe(
      '08:00 - Earhart passes holding the Hot Potato — five points on the board!'
    );
  });

  it('opens and closes the sector with broadcast framing', () => {
    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:00:00.000Z',
          kind: 'ROUND_STARTED',
          captainId: 'armstrong',
          roundNumber: 3,
          spacedockValue: 10,
        }),
        names,
        formatOptions
      )
    ).toBe(
      '00:00 - Round 3 is underway — Spacedock 10! The fleet is live!'
    );
    expect(
      formatCommentatorLine(
        entry({
          at: '2026-06-28T21:00:01.000Z',
          kind: 'MODULE_LOADOUT',
          captainId: 'armstrong',
          moduleLabels: [],
        }),
        names,
        formatOptions
      )
    ).toBe('00:01 - Modules? None — core rules only. Pure Warp.');
  });
});

describe('formatCommentatorLogLines', () => {
  it('digests a mixed log down to highlights only', () => {
    const lines = formatCommentatorLogLines(
      [
        entry({
          at: '2026-06-28T21:00:00.000Z',
          kind: 'ROUND_STARTED',
          captainId: 'armstrong',
          roundNumber: 1,
          spacedockValue: 12,
        }),
        entry({
          at: '2026-06-28T21:00:10.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'armstrong',
          coordinate: { low: 2, high: 4 },
          route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        }),
        entry({
          at: '2026-06-28T21:00:20.000Z',
          kind: 'DRAW_FROM_UNCHARTED',
          captainId: 'lovell',
        }),
        entry({
          at: '2026-06-28T21:00:30.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'earhart',
          coordinate: { low: 0, high: 0 },
          route: { kind: 'neutral-zone', neutralZone: true },
          effects: ['continuum-flash-pending'],
        }),
        entry({
          at: '2026-06-28T21:01:00.000Z',
          kind: 'ALL_STOP',
          captainId: 'armstrong',
        }),
      ],
      names,
      formatOptions
    );

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Round 1 is underway');
    expect(lines[1]).toContain('Continuum Flash');
    expect(lines[2]).toContain('All Stop!');
  });

  it('emits only sane copy across a highlight suite', () => {
    const suite: GameLogEntry[] = [
      entry({
        at: '2026-06-28T21:00:00.000Z',
        kind: 'ROUND_STARTED',
        captainId: 'armstrong',
        roundNumber: 2,
        spacedockValue: 11,
      }),
      entry({
        at: '2026-06-28T21:00:05.000Z',
        kind: 'MODULE_LOADOUT',
        captainId: 'armstrong',
        moduleLabels: ['Alpha', 'Delta'],
      }),
      entry({
        at: '2026-06-28T21:01:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 6, high: 6 },
        route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
        effects: ['red-alert-opened', 'subspace-fracture-opened'],
      }),
      entry({
        at: '2026-06-28T21:02:00.000Z',
        kind: 'PASS_RED_ALERT',
        captainId: 'lovell',
        nextCaptainId: 'earhart',
      }),
      entry({
        at: '2026-06-28T21:03:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 6, high: 3 },
        route: { kind: 'red-alert-cover', trailCaptainId: 'lovell' },
        effects: ['red-alert-cleared', 'subspace-fracture-cleared'],
      }),
      entry({
        at: '2026-06-28T21:04:00.000Z',
        kind: 'SPOOL_WARP_DRIVE',
        captainId: 'armstrong',
        route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        effects: ['trail-momentum-claimed'],
        spoolDetails: { tilesPlayed: 4, tilesToHand: 0 },
      }),
      entry({
        at: '2026-06-28T21:05:00.000Z',
        kind: 'DROP_TO_IMPULSE',
        captainId: 'lovell',
      }),
      entry({
        at: '2026-06-28T21:05:10.000Z',
        kind: 'CATCH_DROP_TO_IMPULSE',
        captainId: 'earhart',
        targetCaptainId: 'lovell',
        effects: ['return-to-warp'],
      }),
      entry({
        at: '2026-06-28T21:06:00.000Z',
        kind: 'DESPERATION_DIG',
        captainId: 'armstrong',
        desperationDig: { draws: 3, charted: true },
      }),
      entry({
        at: '2026-06-28T21:07:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'lovell',
        coordinate: { low: 9, high: 12 },
        route: { kind: 'neutral-zone', neutralZone: true },
        hotPotato: { taken: true },
        effects: ['wormhole-opened'],
      }),
      entry({
        at: '2026-06-28T21:08:00.000Z',
        kind: 'ALL_STOP',
        captainId: 'armstrong',
      }),
      entry({
        at: '2026-06-28T21:08:01.000Z',
        kind: 'END_ROUND',
        captainId: 'armstrong',
        winnerId: 'armstrong',
        effects: ['round-won'],
      }),
      entry({
        at: '2026-06-28T21:08:02.000Z',
        kind: 'SALAMANDER_PENALTY',
        captainId: 'lovell',
        penaltyPoints: 12,
      }),
      entry({
        at: '2026-06-28T21:08:03.000Z',
        kind: 'LONGEST_TRAIL_BONUS',
        captainId: 'earhart',
        trailLength: 9,
        penaltyPoints: -5,
      }),
      entry({
        at: '2026-06-28T21:08:04.000Z',
        kind: 'TEMPORAL_DEBT_PENALTY',
        captainId: 'armstrong',
        debtTokens: 2,
        penaltyPoints: 4,
      }),
    ];

    const lines = formatCommentatorLogLines(suite, names, formatOptions);
    expect(lines.length).toBe(suite.length);
    for (const line of lines) {
      expect(commentatorLineIsSane(line)).toBe(true);
      expect(line).toMatch(/^\d{2}:\d{2} - /);
      expect(line.length).toBeGreaterThan(20);
    }
  });
});

describe('commentatorLineIsSane', () => {
  it('rejects banned sports-bar phrasing', () => {
    for (const phrase of COMMENTATOR_BANNED_PHRASES) {
      expect(commentatorLineIsSane(`Armstrong ${phrase} the trail`)).toBe(
        false
      );
    }
  });

  it('accepts federation broadcast copy', () => {
    expect(
      commentatorLineIsSane(
        '05:12 - All Stop! Armstrong empties the hand — what a finish!'
      )
    ).toBe(true);
    expect(
      commentatorLineIsSane(
        '02:00 - Red Alert — the Double sits uncovered!'
      )
    ).toBe(true);
  });
});

/**
 * Every lettered module + Subspace Fracture must earn a ringside highlight
 * with federation terms and sane copy (points + go-out forks).
 */
describe('module highlight matrix', () => {
  type ModuleCase = {
    readonly id: string;
    readonly entry: GameLogEntry;
    readonly mustInclude: readonly string[];
    readonly mustNotInclude?: readonly string[];
  };

  const cases: readonly ModuleCase[] = [
    {
      id: 'Alpha · Continuum Flash pending',
      entry: entry({
        at: '2026-06-28T21:01:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 0, high: 0 },
        route: { kind: 'neutral-zone', neutralZone: true },
        effects: ['continuum-flash-pending'],
      }),
      mustInclude: ['Continuum Flash', 'Armstrong', 'Double 0-0'],
    },
    {
      id: 'Alpha · Continuum Flash invoke (points)',
      entry: entry({
        at: '2026-06-28T21:01:10.000Z',
        kind: 'INVOKE_CONTINUUM_FLASH',
        captainId: 'lovell',
        flashEffect: 'skip-lowest-points',
      }),
      mustInclude: ['Continuum Flash', 'Lovell', 'skip lowest points'],
    },
    {
      id: 'Alpha · Continuum Flash invoke (go-out Force Draw)',
      entry: entry({
        at: '2026-06-28T21:01:12.000Z',
        kind: 'INVOKE_CONTINUUM_FLASH',
        captainId: 'earhart',
        flashEffect: 'force-draw',
      }),
      mustInclude: ['Continuum Flash', 'Earhart', 'force draw'],
    },
    {
      id: 'Alpha · Continuum Flash invoke (go-out Skip Lightest Hand)',
      entry: entry({
        at: '2026-06-28T21:01:13.000Z',
        kind: 'INVOKE_CONTINUUM_FLASH',
        captainId: 'armstrong',
        flashEffect: 'skip-lightest-hand',
      }),
      mustInclude: ['Continuum Flash', 'skip lightest hand'],
    },
    {
      id: 'Alpha · Q-Gamble resolve',
      entry: entry({
        at: '2026-06-28T21:01:20.000Z',
        kind: 'RESOLVE_CONTINUUM_WAGER',
        captainId: 'lovell',
      }),
      mustInclude: ['Q-Gamble', 'Lovell', 'Continuum'],
    },
    {
      id: 'Beta · Salamander Penalty (points)',
      entry: entry({
        at: '2026-06-28T21:02:00.000Z',
        kind: 'SALAMANDER_PENALTY',
        captainId: 'armstrong',
        penaltyPoints: 24,
      }),
      mustInclude: ['Salamander Penalty', 'Armstrong', '+24'],
    },
    {
      id: 'Beta · Salamander Penalty swap',
      entry: entry({
        at: '2026-06-28T21:02:05.000Z',
        kind: 'SALAMANDER_PENALTY',
        captainId: 'armstrong',
        targetCaptainId: 'lovell',
        penaltyPoints: 24,
      }),
      mustInclude: ['Salamander Penalty', 'swaps to Lovell', '+24'],
    },
    {
      id: 'Beta · Salamander Surge (go-out)',
      entry: entry({
        at: '2026-06-28T21:02:10.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 12, high: 12 },
        route: { kind: 'warp-trail', trailCaptainId: 'earhart' },
        salamanderSurge: { opponentDraws: 2 },
      }),
      mustInclude: ['Salamander Surge', 'fleet draws 2', 'Double 12-12'],
    },
    {
      id: 'Gamma · Sensor Sweep opens Red Alert',
      entry: entry({
        at: '2026-06-28T21:03:00.000Z',
        kind: 'SENSOR_SWEEP',
        captainId: 'armstrong',
        coordinate: { low: 7, high: 7 },
        effects: ['red-alert-opened'],
      }),
      mustInclude: ['sensor-sweeps', 'Double 7-7', 'Red Alert'],
    },
    {
      id: 'Gamma · Sensor Sweep return to warp',
      entry: entry({
        at: '2026-06-28T21:03:05.000Z',
        kind: 'SENSOR_SWEEP',
        captainId: 'lovell',
        coordinate: { low: 4, high: 9 },
        effects: ['return-to-warp'],
      }),
      mustInclude: ['sensor-sweeps', '4:9', 'returned to warp'],
    },
    {
      id: 'Delta · Warp Drive Spool',
      entry: entry({
        at: '2026-06-28T21:04:00.000Z',
        kind: 'SPOOL_WARP_DRIVE',
        captainId: 'armstrong',
        route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        spoolDetails: { tilesPlayed: 4, tilesToHand: 1 },
      }),
      mustInclude: ['warp drive', 'their own Trail', '4 tiles', '1 to hand'],
    },
    {
      id: 'Delta · Spool abort retrieve',
      entry: entry({
        at: '2026-06-28T21:04:05.000Z',
        kind: 'SPOOL_WARP_DRIVE',
        captainId: 'lovell',
        route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
        effects: ['spool-abort-retrieve'],
        spoolDetails: {
          tilesPlayed: 2,
          tilesToHand: 2,
          abortedUnfinishedDouble: true,
        },
      }),
      mustInclude: ['warp drive', 'Unfinished double retrieved', 'no Red Alert'],
    },
    {
      id: 'Delta · Hot Potato taken',
      entry: entry({
        at: '2026-06-28T21:04:10.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 5, high: 3 },
        route: { kind: 'neutral-zone', neutralZone: true },
        hotPotato: { taken: true },
      }),
      mustInclude: ['Hot Potato', 'Neutral Zone', 'Earhart'],
    },
    {
      id: 'Delta · Hot Potato pass (points +5)',
      entry: entry({
        at: '2026-06-28T21:04:15.000Z',
        kind: 'PASS_TURN',
        captainId: 'armstrong',
        hotPotato: { passPenalty: true },
      }),
      mustInclude: ['Hot Potato', 'five points'],
    },
    {
      id: 'Delta · Hot Potato pass draws (go-out)',
      entry: entry({
        at: '2026-06-28T21:04:20.000Z',
        kind: 'PASS_TURN',
        captainId: 'lovell',
        hotPotato: { passDraws: 2 },
      }),
      mustInclude: ['Hot Potato', 'draws 2'],
    },
    {
      id: 'Delta · Hot Potato skip next (go-out empty pools)',
      entry: entry({
        at: '2026-06-28T21:04:25.000Z',
        kind: 'PASS_TURN',
        captainId: 'earhart',
        hotPotato: { skipNext: true },
      }),
      mustInclude: ['Hot Potato', 'skips the next turn'],
    },
    {
      id: 'Epsilon · Drafting loadout',
      entry: entry({
        at: '2026-06-28T21:00:01.000Z',
        kind: 'MODULE_LOADOUT',
        captainId: '',
        moduleLabels: ['Module Epsilon · Drafting'],
      }),
      mustInclude: ['Module loadout', 'Epsilon', 'Drafting'],
    },
    {
      id: 'Zeta · Squadrons loadout',
      entry: entry({
        at: '2026-06-28T21:00:01.000Z',
        kind: 'MODULE_LOADOUT',
        captainId: '',
        moduleLabels: ['Module Zeta · Squadrons'],
      }),
      mustInclude: ['Module loadout', 'Zeta', 'Squadrons'],
    },
    {
      id: 'Eta · Temporal Debt (points)',
      entry: entry({
        at: '2026-06-28T21:05:00.000Z',
        kind: 'TEMPORAL_DEBT_PENALTY',
        captainId: 'armstrong',
        debtTokens: 3,
        penaltyPoints: 6,
      }),
      mustInclude: ['Temporal Debt', 'Armstrong', '3 tokens', '+6'],
    },
    {
      id: 'Eta · Desperation Dig strike (go-out)',
      entry: entry({
        at: '2026-06-28T21:05:10.000Z',
        kind: 'DESPERATION_DIG',
        captainId: 'lovell',
        desperationDig: { draws: 2, charted: true },
      }),
      mustInclude: ['Desperation Dig', 'Lovell', 'strikes and charts'],
    },
    {
      id: 'Eta · Desperation Dig miss (go-out)',
      entry: entry({
        at: '2026-06-28T21:05:15.000Z',
        kind: 'DESPERATION_DIG',
        captainId: 'earhart',
        desperationDig: { draws: 3, charted: false },
      }),
      mustInclude: ['Desperation Dig', 'comes up empty'],
    },
    {
      id: 'Theta · Longest Trail Bonus (points)',
      entry: entry({
        at: '2026-06-28T21:06:00.000Z',
        kind: 'LONGEST_TRAIL_BONUS',
        captainId: 'armstrong',
        trailLength: 11,
        penaltyPoints: -3,
      }),
      mustInclude: ['Longest Trail Bonus', 'Armstrong', '11 tiles', '−3'],
    },
    {
      id: 'Theta · Trail Momentum (go-out)',
      entry: entry({
        at: '2026-06-28T21:06:10.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'lovell',
        coordinate: { low: 8, high: 4 },
        route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
        effects: ['trail-momentum-claimed'],
      }),
      mustInclude: ['Trail Momentum', 'keep the conn', 'Lovell'],
    },
    {
      id: 'Theta · Trail Momentum on spool (go-out)',
      entry: entry({
        at: '2026-06-28T21:06:15.000Z',
        kind: 'SPOOL_WARP_DRIVE',
        captainId: 'earhart',
        route: { kind: 'warp-trail', trailCaptainId: 'earhart' },
        effects: ['trail-momentum-claimed'],
        spoolDetails: { tilesPlayed: 5, tilesToHand: 0 },
      }),
      mustInclude: ['warp drive', 'Trail Momentum', 'keep the conn'],
    },
    {
      id: 'Iota · Double Down',
      entry: entry({
        at: '2026-06-28T21:07:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 9, high: 9 },
        route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        doubleDown: { targetCaptainId: 'lovell', drawCount: 2 },
      }),
      mustInclude: ['Double Down', 'Lovell draws 2', 'Double 9-9'],
    },
    {
      id: 'Kappa · Temporal Inversion round end (points)',
      entry: entry({
        at: '2026-06-28T21:08:00.000Z',
        kind: 'END_ROUND',
        captainId: 'armstrong',
        winnerId: 'armstrong',
        roundInverted: true,
        roundWinnerIds: ['lovell'],
        effects: ['round-won'],
      }),
      mustInclude: [
        'Inverted round',
        'Armstrong goes out',
        'maximum penalty',
        'Lovell takes the round',
        'heaviest hand',
      ],
    },
    {
      id: 'Kappa · Hand Exchange opened (go-out)',
      entry: entry({
        at: '2026-06-28T21:08:10.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 6, high: 6 },
        route: { kind: 'warp-trail', trailCaptainId: 'earhart' },
        effects: ['hand-exchange-opened'],
        handExchange: {
          largerCaptainId: 'armstrong',
          smallerCaptainId: 'lovell',
        },
      }),
      mustInclude: [
        'Hand Exchange',
        'Armstrong takes from Lovell',
        'Double 6-6',
      ],
      mustNotInclude: ['Hand Exchange! Hand Exchange'],
    },
    {
      id: 'Kappa · Hand Exchange resolve (go-out)',
      entry: entry({
        at: '2026-06-28T21:08:20.000Z',
        kind: 'RESOLVE_HAND_EXCHANGE',
        captainId: 'armstrong',
        targetCaptainId: 'lovell',
        handExchange: {
          largerCaptainId: 'armstrong',
          smallerCaptainId: 'lovell',
        },
      }),
      mustInclude: ['Hand Exchange complete', 'Armstrong', 'Lovell'],
    },
    {
      id: 'Lambda · Wormhole',
      entry: entry({
        at: '2026-06-28T21:09:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'lovell',
        coordinate: { low: 10, high: 10 },
        route: { kind: 'neutral-zone', neutralZone: true },
        effects: ['wormhole-opened'],
      }),
      mustInclude: ['Wormhole', 'Neutral Zone', 'swap'],
    },
    {
      id: 'Zeta · Squadron trail beacon cleared',
      entry: entry({
        at: '2026-06-28T21:06:30.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 3, high: 2 },
        route: {
          kind: 'warp-trail',
          trailCaptainId: 'armstrong',
          squadronTrail: true,
        },
        effects: ['beacon-cleared'],
      }),
      mustInclude: [
        'Earhart',
        'squadron Trail',
        'Distress Beacon cleared',
      ],
    },
    {
      id: 'Subspace Fracture opened',
      entry: entry({
        at: '2026-06-28T21:09:10.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 3, high: 3 },
        route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        effects: ['subspace-fracture-opened'],
      }),
      mustInclude: ['Subspace Fracture opens', 'Double 3-3'],
    },
    {
      id: 'Subspace Fracture cleared',
      entry: entry({
        at: '2026-06-28T21:09:20.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 3, high: 8 },
        route: { kind: 'fracture-stabilizer' },
        effects: ['subspace-fracture-cleared'],
      }),
      mustInclude: ['Fracture closed', '3:8'],
    },
    {
      id: 'Dead double (Fracture / cover waived)',
      entry: entry({
        at: '2026-06-28T21:09:30.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'lovell',
        coordinate: { low: 11, high: 11 },
        route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
        effects: ['dead-double'],
      }),
      mustInclude: ['Double is dead', 'no cover required'],
    },
  ];

  it.each(cases)('$id is a highlight with sane federation copy', (mod) => {
    expect(isCommentatorHighlight(mod.entry)).toBe(true);
    const line = formatCommentatorLine(mod.entry, names, formatOptions);
    expect(line.length).toBeGreaterThan(0);
    expect(commentatorLineIsSane(line)).toBe(true);
    for (const needle of mod.mustInclude) {
      expect(line).toContain(needle);
    }
    for (const banned of mod.mustNotInclude ?? []) {
      expect(line).not.toContain(banned);
    }
    // No tile-identity leaks beyond public chart coordinates in the entry.
    expect(line).not.toMatch(/\btakes \d+-\d+\b|\bstole\b|\bgive-back\b/i);
  });

  it('loadout callout names every lettered module under points', () => {
    const loadout = buildModuleLoadoutEntry(
      resolveModules({
        continuum: true,
        salamanderPenalty: true,
        sensorGrid: true,
        warpDriveSpool: true,
        drafting: true,
        squadrons: true,
        temporalDebt: true,
        longestTrail: true,
        doubleDown: true,
        temporalInversion: true,
        wormholes: true,
        subspaceFracture: true,
      }),
      2,
      '2026-06-28T21:00:01.000Z',
      'points'
    );
    const line = formatCommentatorLine(loadout, names, formatOptions);
    expect(isCommentatorHighlight(loadout)).toBe(true);
    expect(commentatorLineIsSane(line)).toBe(true);
    for (const greek of [
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Epsilon',
      'Zeta',
      'Eta',
      'Theta',
      'Iota',
      'Kappa',
      'Lambda',
    ]) {
      expect(line).toContain(greek);
    }
    expect(line).toContain('Subspace Fracture');
    expect(line).toContain('INVERTED');
  });

  it('loadout callout renames Kappa to Hand Exchange under go-out', () => {
    const loadout = buildModuleLoadoutEntry(
      resolveModules({ temporalInversion: true }),
      1,
      '2026-06-28T21:00:01.000Z',
      'go-out'
    );
    const line = formatCommentatorLine(loadout, names, formatOptions);
    expect(line).toContain('Hand Exchange');
    expect(line).not.toContain('Temporal Inversion');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('skips routine Gamma sensor sweeps that are not crises', () => {
    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:03:40.000Z',
          kind: 'SENSOR_SWEEP',
          captainId: 'armstrong',
          coordinate: { low: 2, high: 5 },
        })
      )
    ).toBe(false);
  });
});

describe('opening callouts — engine → commentator', () => {
  const captainNames = { a: 'Armstrong', b: 'Lovell' };

  it('calls the round opening chart on the starter own trail with the tile', () => {
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [T(12, 5)], b: [T(1, 2)] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
        },
      })
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const result = applyAction(before, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stamped = {
      ...buildGameLogEntry(before, result.state, action)!,
      at: '2026-06-28T21:00:02.000Z',
    };
    expect(stamped.effects).toContain('round-opened');
    expect(stamped.effects).not.toContain('neutral-zone-opened');

    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(isCommentatorHighlight(stamped)).toBe(true);
    expect(line).toContain(
      'Armstrong opens with a 5:12 on their own Trail!'
    );
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('calls the round opening chart on the Neutral Zone with the tile', () => {
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [T(12, 8)], b: [T(1, 2)] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
        },
      })
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: T(12, 8),
      route: { kind: 'neutral-zone' as const },
    };
    const result = applyAction(before, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stamped = {
      ...buildGameLogEntry(before, result.state, action)!,
      at: '2026-06-28T21:00:02.000Z',
    };
    expect(stamped.effects).toContain('round-opened');
    expect(stamped.effects).toContain('neutral-zone-opened');

    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(isCommentatorHighlight(stamped)).toBe(true);
    expect(line).toContain(
      'Armstrong opens with a 8:12 on the Neutral Zone!'
    );
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('calls the first mid-round Neutral Zone chart with the opening tile', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'b',
        hands: { a: [T(1, 2)], b: [T(12, 3)] },
        table: {
          ...table,
          warpTrails: {
            ...table.warpTrails,
            a: {
              ...table.warpTrails.a!,
              tiles: [placed(T(12, 9), 12, 9)],
            },
          },
        },
      })
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'b',
      coordinate: T(12, 3),
      route: { kind: 'neutral-zone' as const },
    };
    const result = applyAction(before, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stamped = {
      ...buildGameLogEntry(before, result.state, action)!,
      at: '2026-06-28T21:03:00.000Z',
    };
    expect(stamped.effects).toContain('neutral-zone-opened');
    expect(stamped.effects).not.toContain('round-opened');

    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(isCommentatorHighlight(stamped)).toBe(true);
    expect(line).toBe(
      '03:00 - Lovell opens the Neutral Zone with a 3:12!'
    );
    expect(commentatorLineIsSane(line)).toBe(true);
  });
});

describe('module engine → commentator integration', () => {
  const captainNames = { a: 'Armstrong', b: 'Lovell', c: 'Earhart' };

  it('calls Hand Exchange from a live Kappa go-out chart', () => {
    const base = makeRound(['a', 'b', 'c'], {
      spacedockValue: 12,
      activePlayerId: 'a',
    });
    const double = T(5, 5);
    const before = makeGame(
      makeRound(['a', 'b', 'c'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: {
          a: [double, T(1, 2), T(2, 3)],
          b: [T(3, 4), T(6, 7), T(8, 9)],
          c: [T(0, 1)],
        },
        table: {
          ...base.table,
          warpTrails: {
            ...base.table.warpTrails,
            a: {
              ...base.table.warpTrails.a!,
              tiles: [placed(T(12, 5), 0, 5)],
              distressBeacon: { active: false },
            },
          },
        },
      }),
      {
        objective: 'go-out',
        modules: resolveModules({ temporalInversion: true }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0 },
          { id: 'b', displayName: 'B', pointsScore: 0 },
          { id: 'c', displayName: 'C', pointsScore: 0 },
        ],
      }
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: double,
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const chart = applyAction(before, action);
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    const logEntry = buildGameLogEntry(before, chart.state, action);
    expect(logEntry).not.toBeNull();
    const stamped = {
      ...logEntry!,
      at: '2026-06-28T21:03:00.000Z',
    };
    expect(isCommentatorHighlight(stamped)).toBe(true);
    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(line).toContain('Hand Exchange');
    expect(line).toContain('Lovell takes from Earhart');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('calls Desperation Dig from a live Eta go-out dig', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [T(9, 9)], b: [T(2, 2)] },
        unchartedSectors: [T(0, 1), T(8, 4), T(3, 4)],
        table: {
          ...base.table,
          warpTrails: {
            ...base.table.warpTrails,
            a: {
              ...base.table.warpTrails.a!,
              tiles: [placed(T(12, 8), 0, 8)],
              distressBeacon: { active: false },
            },
          },
        },
      }),
      {
        objective: 'go-out',
        modules: resolveModules({ temporalDebt: true }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0 },
          { id: 'b', displayName: 'B', pointsScore: 0 },
        ],
      }
    );
    const action = { type: 'DESPERATION_DIG' as const, playerId: 'a' };
    const result = applyAction(before, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const logEntry = buildGameLogEntry(before, result.state, action);
    expect(logEntry?.kind).toBe('DESPERATION_DIG');
    const stamped = {
      ...logEntry!,
      at: '2026-06-28T21:04:00.000Z',
    };
    expect(isCommentatorHighlight(stamped)).toBe(true);
    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(line).toContain('Desperation Dig');
    expect(line).toMatch(/strikes and charts|comes up empty/);
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('calls spool abort retrieve from a live Delta abort', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const before = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: {
          a: [T(5, 4)],
          b: [T(3, 2)],
        },
        unchartedSectors: [T(12, 12), T(8, 7)],
        table: {
          ...table,
          warpTrails: {
            ...table.warpTrails,
            a: {
              ...table.warpTrails.a,
              tiles: [],
            },
          },
        },
      }),
      { modules: resolveModules({ warpDriveSpool: true }) }
    );
    const action = {
      type: 'SPOOL_WARP_DRIVE' as const,
      playerId: 'a',
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const result = applyAction(before, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const logEntry = buildGameLogEntry(before, result.state, action);
    expect(logEntry?.effects).toContain('spool-abort-retrieve');
    const stamped = {
      ...logEntry!,
      at: '2026-06-28T21:02:00.000Z',
    };
    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(line).toContain('warp drive');
    expect(line).toContain('Unfinished double retrieved');
    expect(line).toContain('no Red Alert');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('calls Double Down from a live Iota chart', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const double = T(4, 4);
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: {
          a: [double, T(1, 1)],
          b: [T(2, 2), T(3, 3)],
        },
        unchartedSectors: [T(0, 1), T(0, 2), T(0, 3)],
        table: {
          ...base.table,
          warpTrails: {
            ...base.table.warpTrails,
            a: {
              ...base.table.warpTrails.a!,
              tiles: [placed(T(12, 4), 0, 4)],
              distressBeacon: { active: false },
            },
          },
        },
      }),
      {
        modules: resolveModules({ doubleDown: true, doubleDownDrawCount: 2 }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0 },
          { id: 'b', displayName: 'B', pointsScore: 0 },
        ],
      }
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: double,
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const chart = applyAction(before, action);
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    const logEntry = buildGameLogEntry(before, chart.state, action);
    expect(logEntry?.doubleDown).toEqual({
      targetCaptainId: 'b',
      drawCount: 2,
    });
    const stamped = {
      ...logEntry!,
      at: '2026-06-28T21:07:00.000Z',
    };
    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(line).toContain('Double Down');
    expect(line).toContain('Lovell draws 2');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('calls Wormhole from a live Lambda Neutral Zone double', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const double = T(8, 8);
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: {
          a: [double],
          b: [T(1, 2)],
        },
        table: {
          ...base.table,
          neutralZone: {
            ...base.table.neutralZone,
            tiles: [placed(T(12, 8), 0, 8)],
          },
          warpTrails: {
            ...base.table.warpTrails,
            a: {
              ...base.table.warpTrails.a!,
              tiles: [placed(T(12, 5), 0, 5)],
              distressBeacon: { active: false },
            },
          },
        },
      }),
      {
        modules: resolveModules({ wormholes: true }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0 },
          { id: 'b', displayName: 'B', pointsScore: 0 },
        ],
      }
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: double,
      route: { kind: 'neutral-zone' as const },
    };
    const chart = applyAction(before, action);
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.state.round?.wormholeOpened).toBe(true);

    const logEntry = buildGameLogEntry(before, chart.state, action);
    expect(logEntry?.effects).toContain('wormhole-opened');
    const stamped = {
      ...logEntry!,
      at: '2026-06-28T21:09:00.000Z',
    };
    const line = formatCommentatorLine(stamped, captainNames, formatOptions);
    expect(line).toContain('Wormhole');
    expect(commentatorLineIsSane(line)).toBe(true);
  });
});

/**
 * Live Alpha → Zeta engine paths (the early Greek letters that were loadout-
 * light). Theta–Lambda are covered above / in the matrix.
 */
describe('Alpha through Zeta — engine → commentator', () => {
  const namesAZ = {
    a: 'Armstrong',
    b: 'Lovell',
    c: 'Earhart',
    d: 'Yeager',
  };

  it('Alpha: Continuum Flash pending after charting 0-0', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const before = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: { a: [T(0, 0)], b: [T(1, 1)] },
        table: {
          ...table,
          warpTrails: {
            ...table.warpTrails,
            a: {
              ...table.warpTrails.a,
              tiles: [placed(T(12, 0), 0, 0)],
              distressBeacon: { active: false },
            },
          },
        },
      }),
      { modules: resolveModules({ continuum: true }) }
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: T(0, 0),
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const chart = applyAction(before, action);
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    const logEntry = buildGameLogEntry(before, chart.state, action);
    expect(logEntry?.effects).toContain('continuum-flash-pending');
    const line = formatCommentatorLine(
      { ...logEntry!, at: '2026-06-28T21:01:00.000Z' },
      namesAZ,
      formatOptions
    );
    expect(line).toContain('Continuum Flash');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('Beta: Salamander Surge when maxPip double is charted (go-out)', () => {
    const salamander = T(12, 12);
    const before = makeGame(
      makeRound(['a', 'b', 'c'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        unchartedSectors: [T(1, 2), T(3, 4), T(5, 6)],
        hands: {
          a: [salamander],
          b: [T(2, 3)],
          c: [T(4, 5)],
        },
      }),
      {
        objective: 'go-out',
        modules: resolveModules({ salamanderPenalty: true }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0 },
          { id: 'b', displayName: 'B', pointsScore: 0 },
          { id: 'c', displayName: 'C', pointsScore: 0 },
        ],
      }
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: salamander,
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const chart = applyAction(before, action);
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    const logEntry = buildGameLogEntry(before, chart.state, action);
    expect(logEntry?.salamanderSurge?.opponentDraws).toBe(2);
    const line = formatCommentatorLine(
      { ...logEntry!, at: '2026-06-28T21:02:00.000Z' },
      namesAZ,
      formatOptions
    );
    expect(line).toContain('Salamander Surge');
    expect(line).toContain('fleet draws 2');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('Gamma: Sensor Grid loadout is announced; routine sweeps stay silent', () => {
    const loadout = buildModuleLoadoutEntry(
      resolveModules({ sensorGrid: true, sensorGridSize: 5 }),
      1,
      '2026-06-28T21:00:01.000Z'
    );
    const loadoutLine = formatCommentatorLine(loadout, namesAZ, formatOptions);
    expect(loadoutLine).toContain('Gamma');
    expect(loadoutLine).toContain('Sensor Grid');

    expect(
      isCommentatorHighlight(
        entry({
          at: '2026-06-28T21:03:00.000Z',
          kind: 'SENSOR_SWEEP',
          captainId: 'a',
          coordinate: { low: 2, high: 5 },
        })
      )
    ).toBe(false);
  });

  it('Delta: Hot Potato pass draws under go-out', () => {
    const baseTable = makeRound(['a', 'b'], { spacedockValue: 12 }).table;
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [], b: [] },
        unchartedSectors: [T(1, 1), T(2, 2), T(3, 3)],
        hazardMarkerHolder: 'a',
        hazardMarkerPassCount: 0,
        drewThisTurn: true,
        table: {
          ...baseTable,
          warpTrails: {
            ...baseTable.warpTrails,
            a: {
              ...baseTable.warpTrails.a!,
              tiles: [placed(T(12, 8), 0, 8)],
              distressBeacon: { active: true },
            },
          },
        },
      }),
      {
        objective: 'go-out',
        modules: resolveModules({ warpDriveSpool: true }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0 },
          { id: 'b', displayName: 'B', pointsScore: 0 },
        ],
      }
    );
    const action = { type: 'PASS_TURN' as const, playerId: 'a' };
    const result = applyAction(before, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const logEntry = buildGameLogEntry(before, result.state, action);
    expect(logEntry?.hotPotato?.passDraws).toBe(2);
    const line = formatCommentatorLine(
      { ...logEntry!, at: '2026-06-28T21:04:00.000Z' },
      namesAZ,
      formatOptions
    );
    expect(line).toContain('Hot Potato');
    expect(line).toContain('draws 2');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('Epsilon: Drafting appears on the module loadout callout', () => {
    const loadout = buildModuleLoadoutEntry(
      resolveModules({ drafting: true, draftingPackSize: 15 }),
      1,
      '2026-06-28T21:00:01.000Z',
      'points'
    );
    const line = formatCommentatorLine(loadout, namesAZ, formatOptions);
    expect(line).toContain('Epsilon');
    expect(line).toContain('Drafting');
    expect(commentatorLineIsSane(line)).toBe(true);
  });

  it('Zeta: squadmate charting the shared trail clears the beacon on-mic', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);
    const base = makeRound(['a', 'b', 'c', 'd'], {
      spacedockValue: 6,
      activePlayerId: 'c',
      squadrons,
      hands: { a: [], b: [], c: [T(3, 2)], d: [] },
    });
    const before = makeGame(
      {
        ...base,
        table: {
          ...base.table,
          warpTrails: {
            ...base.table.warpTrails,
            a: {
              playerId: 'a',
              tiles: [placed(T(6, 3), 0, 3)],
              distressBeacon: { active: true },
            },
          },
        },
      },
      {
        modules: resolveModules({ squadrons: true, squadronSize: 2 }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0, squadronId: 'squad-1' },
          { id: 'b', displayName: 'B', pointsScore: 0, squadronId: 'squad-2' },
          { id: 'c', displayName: 'C', pointsScore: 0, squadronId: 'squad-1' },
          { id: 'd', displayName: 'D', pointsScore: 0, squadronId: 'squad-2' },
        ],
      }
    );
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'c',
      coordinate: T(3, 2),
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const chart = applyAction(before, action);
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    const logEntry = buildGameLogEntry(before, chart.state, action);
    expect(logEntry?.route?.squadronTrail).toBe(true);
    expect(logEntry?.effects).toContain('beacon-cleared');
    const line = formatCommentatorLine(
      { ...logEntry!, at: '2026-06-28T21:06:00.000Z' },
      namesAZ,
      formatOptions
    );
    expect(line).toContain('Earhart');
    expect(line).toContain('squadron Trail');
    expect(line).toContain('Distress Beacon cleared');
    expect(commentatorLineIsSane(line)).toBe(true);
  });
});
