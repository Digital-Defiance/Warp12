import { describe, expect, it } from 'vitest';
import { applyAction, resolveHouseRules, resolveModules } from 'warp12-engine';

import {
  buildGameLogEntry,
  buildRoundLogExport,
  buildRoundOutcomeEntry,
  buildSalamanderPenaltyLogEntry,
  buildLongestTrailBonusLogEntry,
  buildTemporalDebtPenaltyLogEntry,
  buildModuleLoadoutEntry,
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
  armstrong: 'Armstrong',
  lovell: 'Lovell',
  earhart: 'Earhart',
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
        captainId: 'armstrong',
        coordinate: { low: 5, high: 5 },
        route: { kind: 'warp-trail', trailCaptainId: 'lovell' },
        trainId: 1,
        effects: ['caution-opened'],
      },
      names,
      formatOptions
    );
    expect(caution).toMatch(
      /^00:03 - Armstrong charted a Double 5-5 on Captain Lovell's Trail, raising Yellow alert$/
    );

    const clear = gameLogEntryToString(
      {
        at: '2026-06-28T21:01:45.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'earhart',
        coordinate: { low: 12, high: 7 },
        route: { kind: 'red-alert-cover', trailCaptainId: 'lovell' },
        effects: ['red-alert-cleared'],
      },
      names,
      formatOptions
    );
    expect(clear).toMatch(
      /^01:45 - Earhart charted a 12:7 on Captain Lovell's Trail, clearing the Red Alert$/
    );
  });

  it('formats draw escalation and continuum-flash lines', () => {
    const draw = formatGameLogLine(
      {
        at: '2026-06-28T21:02:10.000Z',
        kind: 'DRAW_FROM_UNCHARTED',
        captainId: 'lovell',
        effects: ['red-alert-opened'],
      },
      names,
      formatOptions
    );
    expect(draw).toBe(
      '02:10 - Lovell drew and could not answer the Double, causing a Red Alert'
    );

    const returnToWarp = formatGameLogLine(
      {
        at: '2026-06-28T21:02:20.000Z',
        kind: 'DRAW_FROM_UNCHARTED',
        captainId: 'lovell',
        effects: ['return-to-warp'],
      },
      names,
      formatOptions
    );
    expect(returnToWarp).toBe(
      '02:20 - Lovell drew from Uncharted Sectors — returned to warp'
    );

    const flash = formatGameLogLine(
      {
        at: '2026-06-28T21:03:00.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 0, high: 0 },
        route: { kind: 'neutral-zone', neutralZone: true },
        effects: ['continuum-flash-pending'],
      },
      names,
      formatOptions
    );
    expect(flash).toMatch(
      /^03:00 - Armstrong charted a Double 0-0 on the Neutral Zone, causing a Continuum Flash$/
    );
  });

  it('clears caution when the double is covered before a pass', () => {
    const clear = formatGameLogLine(
      {
        at: '2026-06-28T21:01:45.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'collins',
        coordinate: { low: 8, high: 10 },
        route: { kind: 'red-alert-cover', trailCaptainId: 'earhart' },
        effects: ['caution-cleared'],
      },
      { ...names, collins: 'Collins', earhart: 'Earhart' },
      formatOptions
    );
    expect(clear).toMatch(/clearing Yellow alert$/);
  });

  it('formats beacon deployment without redundant effect text', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:02:38.000Z',
        kind: 'DEPLOY_DISTRESS_BEACON',
        captainId: 'lovell',
        effects: [],
      },
      names,
      formatOptions
    );
    expect(line).toMatch(
      /^02:38 - Lovell (put up their Distress Beacon|lowered their shields)$/
    );
  });

  it('formats manual shields-up with beacon/shields variety', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:02:40.000Z',
        kind: 'RAISE_SHIELDS',
        captainId: 'lovell',
        effects: [],
      },
      names,
      formatOptions
    );
    expect(line).toMatch(
      /^02:40 - Lovell (raised their shields|took down their Distress Beacon)$/
    );
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
    expect(entry?.effects).toContain('round-opened');
    expect(
      formatGameLogLine(entry!, { a: 'Alpha', b: 'Beta' }, formatOptions)
    ).toMatch(
      /charted a 5:12 on their own Trail, deploying a Distress Beacon$/
    );
  });

  it('tags the first chart of the round as round-opened on any route', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [T(12, 8)], b: [] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
        },
      })
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 8),
      route: { kind: 'neutral-zone' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = buildGameLogEntry(state, result.state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 8),
      route: { kind: 'neutral-zone' },
    });
    expect(entry?.effects).toContain('round-opened');
    expect(entry?.effects).toContain('neutral-zone-opened');
  });

  it('tags the first Neutral Zone chart even mid-round', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const state = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'b',
        hands: { a: [], b: [T(12, 3)] },
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

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'b',
      coordinate: T(12, 3),
      route: { kind: 'neutral-zone' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = buildGameLogEntry(state, result.state, {
      type: 'CHART_COORDINATE',
      playerId: 'b',
      coordinate: T(12, 3),
      route: { kind: 'neutral-zone' },
    });
    expect(entry?.effects).toContain('neutral-zone-opened');
    expect(entry?.effects).not.toContain('round-opened');
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
          { captainId: 'armstrong', tei: 'I15' },
          {
            captainId: 'lovell',
            tei: 'C27',
            tacticalClass: 'Lieutenant',
            reference: true,
          },
        ],
        2,
        '2026-06-28T21:00:00.000Z'
      ),
      { armstrong: 'Armstrong', lovell: 'Lovell' },
      formatOptions
    );
    expect(ratings).toBe(
      '00:00 - Ratings · Armstrong I15 · Lovell ref C27 · Lieutenant'
    );

    // hideTei renders captain classes without the TEI portion.
    const onlineRatings = formatGameLogLine(
      buildRoundRatingsEntry(
        [
          { captainId: 'armstrong', tei: null, hideTei: true },
          {
            captainId: 'lovell',
            tei: null,
            hideTei: true,
            tacticalClass: 'Commander',
          },
        ],
        1,
        '2026-06-28T21:00:00.000Z'
      ),
      { armstrong: 'Armstrong', lovell: 'Lovell' },
      formatOptions
    );
    expect(onlineRatings).toBe('00:00 - Ratings · Armstrong · Lovell · Commander');

    const pass = formatGameLogLine(
      {
        at: '2026-06-28T21:01:04.000Z',
        kind: 'PASS_RED_ALERT',
        captainId: 'yeager',
        nextCaptainId: 'data',
        effects: ['red-alert-opened'],
      },
      { ...names, yeager: 'Yeager', data: 'Data' },
      formatOptions
    );
    expect(pass).toBe(
      '01:04 - Yeager passed Red Alert to Data, causing a Red Alert'
    );

    const win = formatGameLogLine(
      buildRoundOutcomeEntry(
        {
          roundNumber: 2,
          roundWinnerId: 'armstrong',
          roundBlocked: false,
        } as never,
        '2026-06-28T21:12:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(win).toBe('12:00 - Armstrong wins the round');

    // Inverted (Kappa even) round: going out is catastrophic, the trophy goes
    // to whoever held the most — the log must not imply the go-out captain won.
    const inverted = formatGameLogLine(
      {
        at: '2026-06-28T21:12:00.000Z',
        kind: 'END_ROUND',
        captainId: 'armstrong',
        winnerId: 'armstrong',
        roundInverted: true,
        roundWinnerIds: ['lovell'],
        effects: ['round-won'],
      },
      names,
      formatOptions
    );
    expect(inverted).toBe(
      '12:00 - Armstrong goes out — inverted round, max penalty · Lovell takes the round (held the most)'
    );

    // Module loadout — none enabled reads as core rules only.
    const noModules = formatGameLogLine(
      buildModuleLoadoutEntry(
        resolveModules({}),
        1,
        '2026-06-28T21:00:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(noModules).toBe('00:00 - Modules · None (core rules only)');

    // Module Kappa on an odd round: normal scoring, stated explicitly.
    const kappaOdd = formatGameLogLine(
      buildModuleLoadoutEntry(
        resolveModules({ temporalInversion: true }),
        1,
        '2026-06-28T21:00:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(kappaOdd).toBe(
      '00:00 - Modules · Module Kappa · Temporal Inversion (Round 1 normal — lowest hand wins)'
    );

    // Module Kappa on an even round: inverted scoring, stated explicitly.
    const kappaEven = formatGameLogLine(
      buildModuleLoadoutEntry(
        resolveModules({ temporalInversion: true }),
        2,
        '2026-06-28T21:00:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(kappaEven).toBe(
      '00:00 - Modules · Module Kappa · Temporal Inversion (Round 2 INVERTED — highest hand wins)'
    );

    // Multiple modules join in canonical Greek order; Subspace Fracture appends scope.
    const multi = formatGameLogLine(
      buildModuleLoadoutEntry(
        resolveModules({
          warpDriveSpool: true,
          longestTrail: true,
          subspaceFracture: true,
          subspaceFractureScope: 'all-captains',
        }),
        1,
        '2026-06-28T21:00:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(multi).toBe(
      '00:00 - Modules · Module Delta · Hot Potato, Module Theta · Longest Trail, Subspace Fracture (all-captains)'
    );

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

    const salamander = formatGameLogLine(
      buildSalamanderPenaltyLogEntry(
        {
          type: 'SALAMANDER_PENALTY',
          holderId: 'armstrong',
          scoredOnId: 'armstrong',
          points: 72,
        },
        '2026-06-28T21:12:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(salamander).toBe(
      '12:00 - Salamander Penalty · Armstrong holds highest double · +72'
    );

    const longestTrail = formatGameLogLine(
      buildLongestTrailBonusLogEntry(
        {
          type: 'LONGEST_TRAIL_BONUS',
          playerId: 'armstrong',
          trailLength: 19,
          points: -3,
        },
        '2026-06-28T21:12:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(longestTrail).toBe(
      '12:00 - Longest Trail Bonus · Armstrong (19 tiles) · −3'
    );

    const temporalDebt = formatGameLogLine(
      buildTemporalDebtPenaltyLogEntry(
        {
          type: 'TEMPORAL_DEBT_PENALTY',
          playerId: 'armstrong',
          tokens: 8,
          points: 16,
        },
        '2026-06-28T21:12:00.000Z'
      ),
      names,
      formatOptions
    );
    expect(temporalDebt).toBe(
      '12:00 - Temporal Debt · Armstrong (8 tokens) · +16'
    );

    const swapArmedNoop = formatGameLogLine(
      buildSalamanderPenaltyLogEntry(
        {
          type: 'SALAMANDER_PENALTY',
          holderId: 'armstrong',
          scoredOnId: 'armstrong',
          points: 72,
        },
        '2026-06-28T21:12:00.000Z',
        { continuumSwapArmed: true }
      ),
      names,
      formatOptions
    );
    expect(swapArmedNoop).toBe(
      '12:00 - Salamander Penalty · Armstrong holds highest double (already campaign leader; swap no-ops) · +72'
    );

    const swap = formatGameLogLine(
      buildSalamanderPenaltyLogEntry(
        {
          type: 'SALAMANDER_PENALTY',
          holderId: 'armstrong',
          scoredOnId: 'yeager',
          points: 48,
        },
        '2026-06-28T21:12:00.000Z'
      ),
      { ...names, yeager: 'Yeager' },
      formatOptions
    );
    expect(swap).toBe(
      "12:00 - Salamander Penalty · Armstrong's highest double swaps to Yeager · +48"
    );

    const swapEntry = buildSalamanderPenaltyLogEntry(
      {
        type: 'SALAMANDER_PENALTY',
        holderId: 'armstrong',
        scoredOnId: 'yeager',
        points: 72,
      },
      '2026-06-28T21:12:00.000Z',
      { continuumSwapArmed: true }
    );
    expect(swapEntry.effects).toEqual([]);
    expect(
      formatGameLogLine(
        swapEntry,
        { ...names, yeager: 'Yeager' },
        formatOptions
      )
    ).toBe(
      "12:00 - Salamander Penalty · Armstrong's highest double swaps to Yeager · +72"
    );

    const noopEntry = buildSalamanderPenaltyLogEntry(
      {
        type: 'SALAMANDER_PENALTY',
        holderId: 'armstrong',
        scoredOnId: 'armstrong',
        points: 72,
      },
      undefined,
      { continuumSwapArmed: true }
    );
    expect(noopEntry.effects).toEqual(['salamander-swap-noop']);

    const flash = formatGameLogLine(
      {
        at: '2026-06-28T21:12:00.000Z',
        kind: 'INVOKE_CONTINUUM_FLASH',
        captainId: 'armstrong',
        flashEffect: 'salamander-swap',
        effects: [],
      },
      names,
      formatOptions
    );
    expect(flash).toBe(
      '12:00 - Armstrong invoked Continuum Flash · salamander swap'
    );
  });

  it('tags the round-outcome entry as inverted and picks the trophy captain', () => {
    const twoCaptains = [
      { id: 'armstrong', displayName: 'Armstrong', pointsScore: 0 },
      { id: 'lovell', displayName: 'Lovell', pointsScore: 0 },
    ];
    const endedRound = makeRound(['armstrong', 'lovell'], {
      roundNumber: 2,
      phase: 'ended',
      roundWinnerId: 'armstrong',
      hands: { armstrong: [], lovell: [T(5, 5)] },
    });

    // No game supplied → legacy behaviour: plain "wins the round".
    const legacy = buildRoundOutcomeEntry(endedRound, '2026-06-28T21:12:00.000Z');
    expect(legacy.roundInverted).toBe(false);
    expect(formatGameLogLine(legacy, names, formatOptions)).toBe(
      '12:00 - Armstrong wins the round'
    );

    // Game supplied with Kappa on an even round → inverted, trophy to Lovell.
    const invertedGame = makeGame(endedRound, {
      captains: twoCaptains,
      modules: resolveModules({ temporalInversion: true }),
    });
    const inverted = buildRoundOutcomeEntry(
      endedRound,
      '2026-06-28T21:12:00.000Z',
      invertedGame
    );
    expect(inverted.roundInverted).toBe(true);
    expect(inverted.winnerId).toBe('armstrong');
    expect(inverted.roundWinnerIds).toEqual(['lovell']);
    expect(formatGameLogLine(inverted, names, formatOptions)).toBe(
      '12:00 - Armstrong goes out — inverted round, max penalty · Lovell takes the round (held the most)'
    );

    // Same round on an odd number → normal scoring, plain win line.
    const oddRound = makeRound(['armstrong', 'lovell'], {
      roundNumber: 3,
      phase: 'ended',
      roundWinnerId: 'armstrong',
      hands: { armstrong: [], lovell: [T(5, 5)] },
    });
    const normalGame = makeGame(oddRound, {
      captains: twoCaptains,
      modules: resolveModules({ temporalInversion: true }),
    });
    const normal = buildRoundOutcomeEntry(
      oddRound,
      '2026-06-28T21:12:00.000Z',
      normalGame
    );
    expect(normal.roundInverted).toBe(false);
    expect(formatGameLogLine(normal, names, formatOptions)).toBe(
      '12:00 - Armstrong wins the round'
    );
  });

  it('carries inverted round outcome through the online action log path', () => {
    const twoCaptains = [
      { id: 'armstrong', displayName: 'Armstrong', pointsScore: 0 },
      { id: 'lovell', displayName: 'Lovell', pointsScore: 0 },
    ];
    const modules = resolveModules({ temporalInversion: true });
    const before = makeGame(
      makeRound(['armstrong', 'lovell'], {
        roundNumber: 2,
        phase: 'playing',
        hands: { armstrong: [T(3, 4)], lovell: [T(5, 5)] },
      }),
      { captains: twoCaptains, modules }
    );
    const after = makeGame(
      makeRound(['armstrong', 'lovell'], {
        roundNumber: 2,
        phase: 'ended',
        roundWinnerId: 'armstrong',
        hands: { armstrong: [], lovell: [T(5, 5)] },
      }),
      { captains: twoCaptains, modules }
    );

    const entry = buildGameLogEntry(before, after, {
      type: 'END_ROUND',
      winnerId: 'armstrong',
    });
    expect(entry).not.toBeNull();
    expect(entry?.kind).toBe('END_ROUND');
    expect(entry?.roundInverted).toBe(true);
    expect(entry?.roundWinnerIds).toEqual(['lovell']);
    // buildGameLogEntry stamps `at` with the current time, so assert the body
    // rather than the elapsed-time prefix.
    expect(formatGameLogLine(entry!, names, formatOptions)).toContain(
      ' - Armstrong goes out — inverted round, max penalty · Lovell takes the round (held the most)'
    );
  });

  it('omits the trophy suffix on an inverted round with no distinct winner', () => {
    // roundWinnerIds contains only the captain who went out → no "takes the
    // round" clause, but still reads as an inverted max-penalty go-out.
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:12:00.000Z',
        kind: 'END_ROUND',
        captainId: 'armstrong',
        winnerId: 'armstrong',
        roundInverted: true,
        roundWinnerIds: ['armstrong'],
        effects: ['round-won'],
      },
      names,
      formatOptions
    );
    expect(line).toBe(
      '12:00 - Armstrong goes out — inverted round, max penalty'
    );
  });

  it('notes dead doubles that require no cover', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:00:23.000Z',
        kind: 'CHART_COORDINATE',
        captainId: 'armstrong',
        coordinate: { low: 12, high: 12 },
        route: { kind: 'neutral-zone', neutralZone: true },
        effects: ['dead-double'],
      },
      names,
      formatOptions
    );
    expect(line).toBe(
      '00:23 - Armstrong charted a Double 12-12 on the Neutral Zone, the Double is dead — no cover required'
    );
  });

  it('exports round logs with elapsed-time lines', () => {
    const log = createGameLog();
    log.append({
      at: '2026-06-28T21:00:08.000Z',
      kind: 'CHART_COORDINATE',
      captainId: 'armstrong',
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
      '00:08 - Armstrong charted a Double 0-0 on the Neutral Zone, causing a Continuum Flash'
    );
  });

  describe('buildGameLogEntry', () => {
    it('clears caution even when another captain has an unrelated Distress Beacon', () => {
      let state = makeGame(
        makeRound(['you', 'lovell', 'earhart'], {
          activePlayerId: 'earhart',
          hands: {
            you: [],
            lovell: [],
            earhart: [T(6, 6), T(6, 5)],
          },
          table: {
            ...createInitialTable(['you', 'lovell', 'earhart'], 12, 'you'),
            warpTrails: {
              you: {
                playerId: 'you',
                tiles: [
                  placed(T(6, 7), 0, 6),
                ],
                distressBeacon: { active: true },
              },
              lovell: {
                playerId: 'lovell',
                tiles: [],
                distressBeacon: { active: false },
              },
              earhart: {
                playerId: 'earhart',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
          },
        })
      );

      const playDouble = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'earhart',
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
        playerId: 'earhart',
        coordinate: T(6, 5),
        route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
      });
      expect(cover.ok).toBe(true);
      if (!cover.ok) {
        return;
      }

      const entry = buildGameLogEntry(state, cover.state, {
        type: 'CHART_COORDINATE',
        playerId: 'earhart',
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
        makeRound(['glenn', 'collins'], {
          activePlayerId: 'glenn',
          hands: { glenn: [T(2, 9)], collins: [T(8, 9)] },
          table: {
            ...createInitialTable(['glenn', 'collins'], 12, 'glenn'),
            warpTrails: {
              glenn: {
                playerId: 'glenn',
                tiles: [placed(T(9, 12), 0, 9), anchor],
                distressBeacon: { active: false },
              },
              collins: {
                playerId: 'collins',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            subspaceFracture: fracture,
            redAlert: {
              active: true,
              anchor,
              responsiblePlayerId: 'glenn',
              trailPlayerId: 'glenn',
            },
          },
        }),
        { modules: resolveModules({ subspaceFracture: true }) }
      );

      const after = makeGame(
        makeRound(['glenn', 'collins'], {
          activePlayerId: 'glenn',
          hands: { glenn: [], collins: [T(8, 9)] },
          table: {
            ...createInitialTable(['glenn', 'collins'], 12, 'glenn'),
            warpTrails: {
              glenn: {
                playerId: 'glenn',
                tiles: [placed(T(9, 12), 0, 9), anchor],
                distressBeacon: { active: false },
              },
              collins: {
                playerId: 'collins',
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
        playerId: 'glenn',
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
            captainId: 'glenn',
            coordinate: T(2, 9),
            route: { kind: 'fracture-stabilizer' },
            effects: entry?.effects ?? [],
          },
          { glenn: 'Glenn' },
          formatOptions
        )
      ).toBe(
        '00:26 - Glenn charted a 2:9 on a Subspace Fracture stabilizer, clearing the Subspace Fracture, clearing the Red Alert'
      );
    });

    it('does not log a wormhole for a Neutral Zone double unless the engine signaled one', () => {
      const before = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [T(11, 11)], b: [] },
          table: {
            ...createInitialTable(['a', 'b'], 12, 'a'),
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: [placed(T(12, 7), 0, 7)],
                distressBeacon: { active: false },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            neutralZone: {
              tiles: [placed(T(12, 11), 0, 11)],
            },
          },
        })
      );

      // Same lengths as a true swap (heuristic used to false-positive here), but
      // wormholes module off → no wormholeOpened pulse.
      const after = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'b',
          hands: { a: [], b: [] },
          table: {
            ...createInitialTable(['a', 'b'], 12, 'a'),
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: [placed(T(12, 7), 0, 7)],
                distressBeacon: { active: false },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            neutralZone: {
              tiles: [
                placed(T(12, 11), 0, 11),
                placed(T(11, 11), 1, 11),
              ],
            },
          },
          wormholeOpened: false,
        })
      );

      const entry = buildGameLogEntry(before, after, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(11, 11),
        route: { kind: 'neutral-zone' },
      });
      expect(entry?.effects).not.toContain('wormhole-opened');
    });

    it('logs a wormhole only when the engine sets wormholeOpened', () => {
      const before = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [T(11, 11)], b: [] },
        })
      );
      const after = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'b',
          hands: { a: [], b: [] },
          wormholeOpened: true,
        })
      );
      const entry = buildGameLogEntry(before, after, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(11, 11),
        route: { kind: 'neutral-zone' },
      });
      expect(entry?.effects).toContain('wormhole-opened');
    });

    it('logs red alert and subspace fracture when an own-trail double opens a fracture', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const before = makeGame(
      makeRound(['glenn'], {
        activePlayerId: 'glenn',
        hands: { glenn: [T(9, 9)] },
        table: {
          ...createInitialTable(['glenn'], 12, 'glenn'),
          warpTrails: {
            glenn: {
              playerId: 'glenn',
              tiles: [placed(T(9, 12), 0, 9)],
              distressBeacon: { active: false },
            },
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const after = makeGame(
      makeRound(['glenn'], {
        activePlayerId: 'glenn',
        hands: { glenn: [] },
        table: {
          ...createInitialTable(['glenn'], 12, 'glenn'),
          warpTrails: {
            glenn: {
              playerId: 'glenn',
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
            responsiblePlayerId: 'glenn',
            trailPlayerId: 'glenn',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const entry = buildGameLogEntry(before, after, {
      type: 'CHART_COORDINATE',
      playerId: 'glenn',
      coordinate: T(9, 9),
      route: { kind: 'warp-trail', playerId: 'glenn' },
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

  it('logs spool abort retrieve — unfinished double, no Red Alert', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:02:00.000Z',
        kind: 'SPOOL_WARP_DRIVE',
        captainId: 'armstrong',
        route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        effects: ['spool-abort-retrieve'],
        spoolDetails: {
          tilesPlayed: 3,
          tilesToHand: 2,
          abortedUnfinishedDouble: true,
        },
      },
      names,
      formatOptions
    );
    expect(line).toBe(
      '02:00 - Armstrong engaged warp drive on their own Trail (played 3 tiles), retrieving an unfinished double to hand — no Red Alert'
    );
  });

  it('logs spool mismatch with public tiles-to-hand count', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:02:05.000Z',
        kind: 'SPOOL_WARP_DRIVE',
        captainId: 'armstrong',
        route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
        effects: [],
        spoolDetails: {
          tilesPlayed: 2,
          tilesToHand: 1,
        },
      },
      names,
      formatOptions
    );
    expect(line).toBe(
      '02:05 - Armstrong engaged warp drive on their own Trail (played 2 tiles, drew 1 to hand)'
    );
  });

  it('builds spool abort entry from engine spoolAbortRetrieve pulse', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const before = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: {
          a: [T(5, 4)],
          b: [T(3, 2)],
        },
        // Matching double then mismatch cover → abort retrieve
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
    expect(result.state.round?.spoolAbortRetrieve).toBe(true);
    expect(result.state.round?.table.redAlert?.active).toBeFalsy();

    const entry = buildGameLogEntry(before, result.state, action);
    expect(entry?.effects).toContain('spool-abort-retrieve');
    expect(entry?.spoolDetails?.abortedUnfinishedDouble).toBe(true);
    expect(entry?.spoolDetails?.tilesPlayed).toBe(0);
    expect(entry?.spoolDetails?.tilesToHand).toBe(2); // 12-12 + 8-7
  });

  it('logs Hand Exchange open on chart without revealing tiles', () => {
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

    const entry = buildGameLogEntry(before, chart.state, action);
    expect(entry?.effects).toContain('hand-exchange-opened');
    expect(entry?.handExchange).toEqual({
      largerCaptainId: 'b',
      smallerCaptainId: 'c',
    });
    expect(entry?.coordinate).toEqual(double);
    const line = formatGameLogLine(
      {
        ...entry!,
        at: '2026-06-28T21:03:00.000Z',
        captainId: 'armstrong',
        handExchange: {
          largerCaptainId: 'lovell',
          smallerCaptainId: 'earhart',
        },
      },
      names,
      formatOptions
    );
    expect(line).toContain('Hand Exchange! Lovell takes from Earhart');
    expect(line).not.toMatch(/\btakes 0-1\b|\bgive\b/i);
  });

  it('logs Hand Exchange give-back without revealing the coordinate', () => {
    const line = formatGameLogLine(
      {
        at: '2026-06-28T21:03:10.000Z',
        kind: 'RESOLVE_HAND_EXCHANGE',
        captainId: 'lovell',
        targetCaptainId: 'earhart',
        effects: [],
        handExchange: {
          largerCaptainId: 'lovell',
          smallerCaptainId: 'earhart',
        },
      },
      names,
      formatOptions
    );
    expect(line).toBe(
      '03:10 - Lovell completed Hand Exchange with Earhart'
    );
  });

  it('logs Desperation Dig strike vs miss without tile identities', () => {
    expect(
      formatGameLogLine(
        {
          at: '2026-06-28T21:04:00.000Z',
          kind: 'DESPERATION_DIG',
          captainId: 'armstrong',
          effects: [],
          desperationDig: { draws: 2, charted: true },
        },
        names,
        formatOptions
      )
    ).toBe(
      '04:00 - Armstrong dug Desperation Dig and charted a strike'
    );
    expect(
      formatGameLogLine(
        {
          at: '2026-06-28T21:04:05.000Z',
          kind: 'DESPERATION_DIG',
          captainId: 'armstrong',
          effects: [],
          desperationDig: { draws: 3, charted: false },
        },
        names,
        formatOptions
      )
    ).toBe('04:05 - Armstrong dug Desperation Dig — no strike');
  });

  it('builds Desperation Dig entry from engine state (public counts only)', () => {
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

    const entry = buildGameLogEntry(before, result.state, action);
    expect(entry?.kind).toBe('DESPERATION_DIG');
    expect(entry?.desperationDig?.charted).toBe(true);
    expect(entry?.desperationDig?.draws).toBeGreaterThanOrEqual(1);
    // SECURITY: no stolen/drawn tile identity on the public log entry.
    expect(entry?.coordinate).toBeUndefined();
  });

  it('formats Sensor Sweep, Salamander Surge, and Hot Potato streamer lines', () => {
    expect(
      formatGameLogLine(
        {
          at: '2026-06-28T21:05:00.000Z',
          kind: 'SENSOR_SWEEP',
          captainId: 'armstrong',
          coordinate: { low: 6, high: 6 },
          effects: [],
        },
        names,
        formatOptions
      )
    ).toBe(
      '05:00 - Armstrong sensor swept a Double 6-6 from the Sensor Grid'
    );

    expect(
      formatGameLogLine(
        {
          at: '2026-06-28T21:05:10.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'armstrong',
          coordinate: { low: 12, high: 12 },
          route: { kind: 'warp-trail', trailCaptainId: 'armstrong' },
          effects: [],
          salamanderSurge: { opponentDraws: 2 },
        },
        names,
        formatOptions
      )
    ).toContain('→ Salamander Surge! fleet draws 2');

    expect(
      formatGameLogLine(
        {
          at: '2026-06-28T21:05:20.000Z',
          kind: 'CHART_COORDINATE',
          captainId: 'lovell',
          coordinate: { low: 5, high: 3 },
          route: { kind: 'neutral-zone', neutralZone: true },
          effects: [],
          hotPotato: { taken: true },
        },
        names,
        formatOptions
      )
    ).toContain('→ takes the Hot Potato');

    expect(
      formatGameLogLine(
        {
          at: '2026-06-28T21:05:30.000Z',
          kind: 'PASS_TURN',
          captainId: 'lovell',
          effects: [],
          hotPotato: { passDraws: 2 },
        },
        names,
        formatOptions
      )
    ).toBe(
      '05:30 - Lovell passed turn while holding the Hot Potato — draws 2'
    );

    expect(
      formatGameLogLine(
        {
          at: '2026-06-28T21:05:40.000Z',
          kind: 'PASS_TURN',
          captainId: 'earhart',
          effects: [],
          hotPotato: { passPenalty: true },
        },
        names,
        formatOptions
      )
    ).toBe(
      '05:40 - Earhart passed turn while holding the Hot Potato (+5)'
    );
  });

  it('labels Module Kappa as Hand Exchange under go-out', () => {
    const line = formatGameLogLine(
      buildModuleLoadoutEntry(
        resolveModules({ temporalInversion: true }),
        2,
        '2026-06-28T21:00:00.000Z',
        'go-out'
      ),
      names,
      formatOptions
    );
    expect(line).toBe('00:00 - Modules · Module Kappa · Hand Exchange');
  });

  it('logs Hot Potato take on Neutral Zone chart', () => {
    const before = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [T(5, 3)], b: [T(2, 2)] },
      }),
      {
        modules: resolveModules({ warpDriveSpool: true }),
        captains: [
          { id: 'a', displayName: 'A', pointsScore: 0 },
          { id: 'b', displayName: 'B', pointsScore: 0 },
        ],
      }
    );

    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: T(5, 3),
      route: { kind: 'neutral-zone' as const },
    };
    // Detection is route + module gated (engine applies the marker transfer).
    const entry = buildGameLogEntry(before, before, action);
    expect(entry?.hotPotato?.taken).toBe(true);
    expect(
      formatGameLogLine(entry!, { a: 'Armstrong', b: 'Lovell' }, formatOptions)
    ).toContain('takes the Hot Potato');
  });

  it('logs Hot Potato go-out pass draws from engine state', () => {
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

    const entry = buildGameLogEntry(before, result.state, action);
    expect(entry?.hotPotato?.passDraws).toBe(2);
    expect(entry?.coordinate).toBeUndefined();
  });
});
