import { describe, expect, it } from 'vitest';
import { applyAction, resolveHouseRules, resolveModules } from 'warp12-engine';

import {
  buildGameLogEntry,
  buildRoundLogExport,
  buildRoundOutcomeEntry,
  buildRoundRatingsEntry,
  buildRoundStartedEntry,
  createGameLog,
  formatGameLogLine,
  formatRoundElapsedTime,
  gameLogEntryToString,
} from './game-log.js';
import {
  allTilesWithPip,
  makeGame,
  makeRound,
  placed,
  T,
} from '../../../engine/src/lib/engine/test-helpers.js';
import { createInitialTable } from '../../../engine/src/lib/table/table-state.js';

const names = {
  picard: 'Picard',
  riker: 'Riker',
  troi: 'Troi',
};

const roundStart = Date.parse('2026-06-28T21:00:00.000Z');
const formatOptions = { roundStartedAtMs: roundStart };

describe('game-log', () => {
  it('formats elapsed time since round start as MM:SS', () => {
    expect(formatRoundElapsedTime('2026-06-28T21:00:00.000Z', roundStart)).toBe(
      '00:00'
    );
    expect(formatRoundElapsedTime('2026-06-28T21:05:12.000Z', roundStart)).toBe(
      '05:12'
    );
  });

  it('formats chart, caution, and clear lines', () => {
    const caution = formatGameLogLine(
      {
        at: '2026-06-28T21:00:03.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'picard',
        coordinate: { low: 5, high: 5 },
        route: { kind: 'warp-trail', trailCaptainId: 'riker' },
        trainId: 1,
        effects: ['caution-opened'],
      },
      names,
      formatOptions
    );
    expect(caution).toMatch(
      /^00:03 - Picard played a Double 5-5 on Captain Riker's Trail, raising Yellow alert$/
    );

    const clear = gameLogEntryToString(
      {
        at: '2026-06-28T21:01:45.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'troi',
        coordinate: { low: 12, high: 7 },
        route: { kind: 'red-alert-cover', trailCaptainId: 'riker' },
        effects: ['red-alert-cleared'],
      },
      names,
      formatOptions
    );
    expect(clear).toMatch(
      /^01:45 - Troi played a 12:7 on Captain Riker's Trail, clearing the Red Alert$/
    );
  });

  it('formats draw escalation and continuum-flash lines', () => {
    const draw = formatGameLogLine(
      {
        at: '2026-06-28T21:02:10.000Z',
        kind: 'DRAW_FROM_UNCHARTED',
        captainId: 'riker',
        effects: ['red-alert-opened'],
      },
      names,
      formatOptions
    );
    expect(draw).toBe(
      '02:10 - Riker drew and could not answer the Double, causing a Red Alert'
    );

    const returnToWarp = formatGameLogLine(
      {
        at: '2026-06-28T21:02:20.000Z',
        kind: 'DRAW_FROM_UNCHARTED',
        captainId: 'riker',
        effects: ['return-to-warp'],
      },
      names,
      formatOptions
    );
    expect(returnToWarp).toBe(
      '02:20 - Riker drew from Uncharted Sectors — returned to warp'
    );

    const flash = formatGameLogLine(
      {
        at: '2026-06-28T21:03:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'picard',
        coordinate: { low: 0, high: 0 },
        route: { kind: 'neutral-zone', neutralZone: true },
        effects: ['continuum-flash-pending'],
      },
      names,
      formatOptions
    );
    expect(flash).toMatch(
      /^03:00 - Picard played a Double 0-0 on the Neutral Zone, causing a Continuum Flash$/
    );
  });

  it('clears caution when the double is covered before a pass', () => {
    const clear = formatGameLogLine(
      {
        at: '2026-06-28T21:01:45.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'uhura',
        coordinate: { low: 8, high: 10 },
        route: { kind: 'red-alert-cover', trailCaptainId: 'troi' },
        effects: ['caution-cleared'],
      },
      { ...names, uhura: 'Uhura', troi: 'Troi' },
      formatOptions
    );
    expect(clear).toMatch(/clearing Yellow alert$/);
  });

  it('formats beacon deployment without redundant effect text', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:02:38.000Z',
        kind: 'DEPLOY_DISTRESS_BEACON',
        captainId: 'riker',
        effects: [],
      },
      names,
      formatOptions
    );
    expect(line).toBe('02:38 - Riker deployed a Distress Beacon');
  });

  it('logs a silent opening beacon when the round starter cannot play twice', () => {
    const deluxeTwo = resolveHouseRules({ roundStarterPlaysTwo: true });
    const state = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [T(12, 5)], b: [] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
        },
      }),
      { houseRules: deluxeTwo }
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = buildGameLogEntry(state, result.state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(entry?.effects).toContain('beacon-deployed');
    expect(
      formatGameLogLine(entry!, { a: 'Alpha', b: 'Beta' }, formatOptions)
    ).toMatch(
      /played a 5:12 on their own Trail, deploying a Distress Beacon$/
    );
  });

  it('formats round bookends and pass-red-alert handoff', () => {
    const started = formatGameLogLine(
      buildRoundStartedEntry(
        {
          roundNumber: 2,
          spacedockValue: 11,
        } as never,
        '2026-06-28T21:00:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(started).toBe('00:00 - Round 2 begins · Spacedock 11');

    const ratings = formatGameLogLine(
      buildRoundRatingsEntry(
        [
          { captainId: 'picard', tei: 1180 },
          {
            captainId: 'riker',
            tei: 1200,
            tacticalClass: 'Class III',
            reference: true,
          },
        ],
        2,
        '2026-06-28T21:00:00.000Z'
      ),
      { picard: 'Picard', riker: 'Riker' },
      formatOptions
    );
    expect(ratings).toBe(
      '00:00 - Ratings · Picard TEI 1180 · Riker ~TEI 1200 · Class III'
    );

    // hideTei renders captain classes without the TEI portion.
    const onlineRatings = formatGameLogLine(
      buildRoundRatingsEntry(
        [
          { captainId: 'picard', tei: null, hideTei: true },
          {
            captainId: 'riker',
            tei: null,
            hideTei: true,
            tacticalClass: 'Class II',
          },
        ],
        1,
        '2026-06-28T21:00:00.000Z'
      ),
      { picard: 'Picard', riker: 'Riker' },
      formatOptions
    );
    expect(onlineRatings).toBe('00:00 - Ratings · Picard · Riker · Class II');

    const pass = formatGameLogLine(
      {
        at: '2026-06-28T21:01:04.000Z',
        kind: 'PASS_RED_ALERT',
        captainId: 'worf',
        nextCaptainId: 'data',
        effects: ['red-alert-opened'],
      },
      { ...names, worf: 'Worf', data: 'Data' },
      formatOptions
    );
    expect(pass).toBe(
      '01:04 - Worf passed Red Alert to Data, causing a Red Alert'
    );

    const win = formatGameLogLine(
      buildRoundOutcomeEntry(
        {
          roundNumber: 2,
          roundWinnerId: 'picard',
          roundBlocked: false,
        } as never,
        '2026-06-28T21:12:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(win).toBe('12:00 - Picard wins the round');

    const blocked = formatGameLogLine(
      buildRoundOutcomeEntry(
        {
          roundNumber: 2,
          roundWinnerId: null,
          roundBlocked: true,
        } as never,
        '2026-06-28T21:12:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(blocked).toBe('12:00 - Round blocked — no legal charts remain');
  });

  it('notes dead doubles that require no cover', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:00:23.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'picard',
        coordinate: { low: 12, high: 12 },
        route: { kind: 'neutral-zone', neutralZone: true },
        effects: ['dead-double'],
      },
      names,
      formatOptions
    );
    expect(line).toBe(
      '00:23 - Picard played a Double 12-12 on the Neutral Zone, the Double is dead — no cover required'
    );
  });

  it('exports round logs with elapsed-time lines', () => {
    const log = createGameLog();
    log.append({
      at: '2026-06-28T21:00:08.000Z',
      kind: 'CHART_COORDINATE',
      captainId: 'picard',
      coordinate: { low: 0, high: 0 },
      route: { kind: 'neutral-zone', neutralZone: true },
      trainId: 7,
      effects: ['continuum-flash-pending'],
    });

    const payload = buildRoundLogExport(log.snapshot(), 2, names, {
      sectorCode: '8SU55R',
      exportedAt: '2026-06-28T21:38:21.000Z',
      roundStartedAtMs: roundStart,
    });

    expect(payload.roundNumber).toBe(2);
    expect(payload.sectorCode).toBe('8SU55R');
    expect(payload.entries).toHaveLength(1);
    expect(payload.lines[0]).toBe(
      '00:08 - Picard played a Double 0-0 on the Neutral Zone, causing a Continuum Flash'
    );
  });

  describe('buildGameLogEntry', () => {
    it('clears caution even when another captain has an unrelated Distress Beacon', () => {
      let state = makeGame(
        makeRound(['you', 'riker', 'troi'], {
          activePlayerId: 'troi',
          hands: {
            you: [],
            riker: [],
            troi: [T(6, 6), T(6, 5)],
          },
          table: {
            ...createInitialTable(['you', 'riker', 'troi'], 12, 'you'),
            warpTrails: {
              you: {
                playerId: 'you',
                tiles: [
                  placed(T(6, 7), 0, 6),
                ],
                distressBeacon: { active: true },
              },
              riker: {
                playerId: 'riker',
                tiles: [],
                distressBeacon: { active: false },
              },
              troi: {
                playerId: 'troi',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
          },
        })
      );

      const playDouble = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'troi',
        coordinate: T(6, 6),
        route: { kind: 'warp-trail', playerId: 'you' },
      });
      expect(playDouble.ok).toBe(true);
      if (!playDouble.ok) {
        return;
      }
      state = playDouble.state;

      const cover = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'troi',
        coordinate: T(6, 5),
        route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
      });
      expect(cover.ok).toBe(true);
      if (!cover.ok) {
        return;
      }

      const entry = buildGameLogEntry(state, cover.state, {
        type: 'CHART_COORDINATE',
        playerId: 'troi',
        coordinate: T(6, 5),
        route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
      });
      expect(entry?.effects).toContain('caution-cleared');
      expect(entry?.effects).not.toContain('red-alert-cleared');
    });

    it('marks exhausted pip doubles as dead with no cover required', () => {
      const deadDouble = T(12, 12);
      const otherTwelves = allTilesWithPip(12).filter(
        (coordinate) =>
          !(coordinate.low === deadDouble.low && coordinate.high === deadDouble.high)
      );

      const before = makeGame(
        makeRound(['a', 'b'], {
          spacedockValue: 11,
          activePlayerId: 'a',
          hands: { a: [deadDouble], b: [] },
        })
      );

      const after = makeGame(
        makeRound(['a', 'b'], {
          spacedockValue: 11,
          activePlayerId: 'a',
          hands: { a: [], b: [] },
          table: {
            ...createInitialTable(['a', 'b'], 11, 'a'),
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: otherTwelves.map((coordinate, index) =>
                  placed(coordinate, index, index === 0 ? 11 : coordinate.low)
                ),
                distressBeacon: { active: false },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            neutralZone: {
              tiles: [placed(deadDouble, 0, 11)],
            },
            redAlert: null,
          },
        })
      );

      const entry = buildGameLogEntry(before, after, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: deadDouble,
        route: { kind: 'neutral-zone' },
      });
      expect(entry?.effects).toContain('dead-double');
      expect(entry?.effects).not.toContain('caution-opened');
      expect(entry?.effects).not.toContain('subspace-fracture-opened');
    });

    it('records pass-red-alert handoff to the next responsible captain', () => {
      const round = makeRound(['a', 'b', 'c'], {
        activePlayerId: 'a',
        hands: { a: [], b: [], c: [] },
        unchartedSectors: [],
        table: {
          ...createInitialTable(['a', 'b', 'c'], 12, 'a'),
          redAlert: {
            active: true,
            anchor: placed(T(5, 5), 0, 5),
            responsiblePlayerId: 'a',
            trailPlayerId: 'b',
          },
        },
      });
      const before = makeGame(round);
      const afterRound: typeof round = {
        ...round,
        table: {
          ...round.table,
          redAlert: {
            ...round.table.redAlert!,
            responsiblePlayerId: 'b',
            passed: true,
          },
          warpTrails: {
            ...round.table.warpTrails,
            a: {
              ...round.table.warpTrails.a,
              distressBeacon: { active: true },
            },
          },
        },
      };
      const after = makeGame(afterRound);

      const entry = buildGameLogEntry(before, after, {
        type: 'PASS_RED_ALERT',
        playerId: 'a',
      });

      expect(entry?.nextCaptainId).toBe('b');
      expect(entry?.effects).toContain('red-alert-opened');
    });

    it('flags Continuum Flash when 0-0 is charted on the invoker own trail', () => {
      const before = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [T(0, 0)], b: [] },
        }),
        { modules: resolveModules({ continuum: true }) }
      );

      const after = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [], b: [] },
          continuumPendingInvoker: 'a',
          table: {
            ...createInitialTable(['a', 'b'], 12, 'a'),
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: [placed(T(0, 0), 0, 12)],
                distressBeacon: { active: false },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            redAlert: {
              active: true,
              anchor: placed(T(0, 0), 0, 12),
              responsiblePlayerId: 'a',
              trailPlayerId: 'a',
            },
          },
        }),
        { modules: resolveModules({ continuum: true }) }
      );

      const entry = buildGameLogEntry(before, after, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(0, 0),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(entry?.effects).toContain('continuum-flash-pending');
    });

    it('does not repeat opening Subspace Fracture on stabilizer charts', () => {
      const anchor = placed(T(5, 5), 0, 5);
      const firstStabilizer = placed(T(5, 3), 1, 5);
      const fracture = {
        active: true,
        anchor,
        stabilizers: [firstStabilizer],
        requiredValue: 5,
      };

      const before = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [T(5, 4)], b: [] },
          table: {
            ...createInitialTable(['a', 'b'], 12, 'a'),
            subspaceFracture: fracture,
          },
        })
      );

      const after = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [], b: [] },
          table: {
            ...createInitialTable(['a', 'b'], 12, 'a'),
            subspaceFracture: {
              ...fracture,
              stabilizers: [...fracture.stabilizers, placed(T(5, 4), 2, 5)],
            },
          },
        })
      );

      const entry = buildGameLogEntry(before, after, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(5, 4),
        route: { kind: 'fracture-stabilizer' },
      });
      expect(entry?.effects).not.toContain('subspace-fracture-opened');
    });

    it('clears subspace fracture and red alert on the third stabilizer', () => {
      const anchor = placed(T(9, 9), 1, 9);
      const fracture = {
        active: true,
        anchor,
        stabilizers: [placed(T(4, 9), 0, 9), placed(T(1, 9), 1, 9)],
        requiredValue: 9,
      };

      const before = makeGame(
        makeRound(['laforge', 'uhura'], {
          activePlayerId: 'laforge',
          hands: { laforge: [T(2, 9)], uhura: [T(8, 9)] },
          table: {
            ...createInitialTable(['laforge', 'uhura'], 12, 'laforge'),
            warpTrails: {
              laforge: {
                playerId: 'laforge',
                tiles: [placed(T(9, 12), 0, 9), anchor],
                distressBeacon: { active: false },
              },
              uhura: {
                playerId: 'uhura',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            subspaceFracture: fracture,
            redAlert: {
              active: true,
              anchor,
              responsiblePlayerId: 'laforge',
              trailPlayerId: 'laforge',
            },
          },
        }),
        { modules: resolveModules({ subspaceFracture: true }) }
      );

      const after = makeGame(
        makeRound(['laforge', 'uhura'], {
          activePlayerId: 'laforge',
          hands: { laforge: [], uhura: [T(8, 9)] },
          table: {
            ...createInitialTable(['laforge', 'uhura'], 12, 'laforge'),
            warpTrails: {
              laforge: {
                playerId: 'laforge',
                tiles: [placed(T(9, 12), 0, 9), anchor],
                distressBeacon: { active: false },
              },
              uhura: {
                playerId: 'uhura',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            subspaceFracture: {
              ...fracture,
              active: false,
              stabilizers: [...fracture.stabilizers, placed(T(2, 9), 2, 9)],
            },
            redAlert: null,
          },
        }),
        { modules: resolveModules({ subspaceFracture: true }) }
      );

      const entry = buildGameLogEntry(before, after, {
        type: 'CHART_COORDINATE',
        playerId: 'laforge',
        coordinate: T(2, 9),
        route: { kind: 'fracture-stabilizer' },
      });

      expect(entry?.effects).toEqual([
        'subspace-fracture-cleared',
        'red-alert-cleared',
      ]);
      expect(
        formatGameLogLine(
          {
            at: '2026-06-28T21:00:26.000Z',
            kind: 'CHART_COORDINATE',
            captainId: 'laforge',
            coordinate: T(2, 9),
            route: { kind: 'fracture-stabilizer' },
            effects: entry?.effects ?? [],
          },
          { laforge: 'La Forge' },
          formatOptions
        )
      ).toBe(
        '00:26 - La Forge played a 2:9 on a Subspace Fracture stabilizer, clearing the Subspace Fracture, clearing the Red Alert'
      );
    });

    it('logs red alert and subspace fracture when an own-trail double opens a fracture', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const before = makeGame(
      makeRound(['laforge'], {
        activePlayerId: 'laforge',
        hands: { laforge: [T(9, 9)] },
        table: {
          ...createInitialTable(['laforge'], 12, 'laforge'),
          warpTrails: {
            laforge: {
              playerId: 'laforge',
              tiles: [placed(T(9, 12), 0, 9)],
              distressBeacon: { active: false },
            },
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const after = makeGame(
      makeRound(['laforge'], {
        activePlayerId: 'laforge',
        hands: { laforge: [] },
        table: {
          ...createInitialTable(['laforge'], 12, 'laforge'),
          warpTrails: {
            laforge: {
              playerId: 'laforge',
              tiles: [placed(T(9, 12), 0, 9), anchor],
              distressBeacon: { active: false },
            },
          },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [],
            requiredValue: 9,
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'laforge',
            trailPlayerId: 'laforge',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const entry = buildGameLogEntry(before, after, {
      type: 'CHART_COORDINATE',
      playerId: 'laforge',
      coordinate: T(9, 9),
      route: { kind: 'warp-trail', playerId: 'laforge' },
    });

    expect(entry?.effects).toContain('red-alert-opened');
    expect(entry?.effects).toContain('subspace-fracture-opened');
    expect(entry?.effects).not.toContain('caution-opened');
    });

    it('logs return to warp when a stuck impulse draw ends Drop to Impulse', () => {
      const impulse = resolveHouseRules({ dropToImpulseCall: true });
      const base = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 12,
        dropToImpulseCallPending: 'a',
        hands: { a: [T(3, 4)], b: [] },
        unchartedSectors: [T(0, 1)],
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(T(12, 3), 0, 12)],
              distressBeacon: { active: true },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
        },
      });
      const before = makeGame(base, { houseRules: impulse });
      const draw = applyAction(before, {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'a',
      });
      expect(draw.ok).toBe(true);
      if (!draw.ok) return;

      const entry = buildGameLogEntry(before, draw.state, {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'a',
      });
      expect(entry?.effects).toContain('return-to-warp');
      expect(
        formatGameLogLine(
          {
            at: '2026-06-28T21:04:00.000Z',
            kind: 'DRAW_FROM_UNCHARTED',
            captainId: 'a',
            effects: entry?.effects ?? [],
          },
          { a: 'Alpha' },
          formatOptions
        )
      ).toBe('04:00 - Alpha drew from Uncharted Sectors — returned to warp');
    });

    it('logs return to warp when a catch penalty draw ends Drop to Impulse', () => {
      const impulse = resolveHouseRules({ dropToImpulseCall: true });
      const before = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'b',
          dropToImpulseCatchable: 'a',
          hands: { a: [T(3, 4)], b: [] },
          unchartedSectors: [T(0, 1)],
          table: createInitialTable(['a', 'b'], 12, 'a'),
        }),
        { houseRules: impulse }
      );
      const caught = applyAction(before, {
        type: 'CATCH_DROP_TO_IMPULSE',
        challengerId: 'b',
        targetPlayerId: 'a',
      });
      expect(caught.ok).toBe(true);
      if (!caught.ok) return;

      const entry = buildGameLogEntry(before, caught.state, {
        type: 'CATCH_DROP_TO_IMPULSE',
        challengerId: 'b',
        targetPlayerId: 'a',
      });
      expect(entry?.effects).toContain('return-to-warp');
      expect(
        formatGameLogLine(
          {
            at: '2026-06-28T21:04:10.000Z',
            kind: 'CATCH_DROP_TO_IMPULSE',
            captainId: 'b',
            targetCaptainId: 'a',
            effects: entry?.effects ?? [],
          },
          { a: 'Alpha', b: 'Beta' },
          formatOptions
        )
      ).toBe(
        '04:10 - Beta caught Alpha for a missed Drop to Impulse — Alpha returned to warp'
      );
    });
  });
});
