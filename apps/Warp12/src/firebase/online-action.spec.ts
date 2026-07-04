import { describe, expect, it } from 'vitest';
import {
  applyAction,
  resolveHouseRules,
  type GameAction,
} from 'warp12-engine';

import { buildGameLogEntry } from 'warp12-react';

import { detectGameSoundTransitions } from '../game/use-game-sounds.js';
import { buildPublicDoc, prepareOnlineAction } from './online-action.js';
import type { FirestoreGameDocument } from './schema.js';
import {
  makeGame,
  makeRound,
  placed,
  T,
} from '../../../../libs/engine/src/lib/engine/test-helpers.js';
import { createInitialTable } from '../../../../libs/engine/src/lib/table/table-state.js';

function onlineDoc(
  state: ReturnType<typeof makeGame>,
  hand: readonly { low: number; high: number }[]
): FirestoreGameDocument {
  const doc = buildPublicDoc(state, {
    hostId: 'a',
    createdAt: '2026-06-28T21:00:00.000Z',
    captains: state.captains
      .filter((c) => state.round?.turnOrder.includes(c.id))
      .map((c) => ({
        id: c.id,
        displayName: c.displayName,
        pointsScore: c.pointsScore,
        joinedAt: '2026-06-28T21:00:00.000Z',
      })),
  });
  if (doc.round && state.round) {
    doc.round = {
      ...doc.round,
      handCounts: Object.fromEntries(
        state.round.turnOrder.map((id) => [
          id,
          id === 'a' ? hand.length : state.round!.hands[id]?.length ?? 0,
        ])
      ),
    };
  }
  return doc;
}

describe('prepareOnlineAction', () => {
  const manual = resolveHouseRules({ manualShieldControl: true });

  it('runs manual shield chart → raise → pass through the online pipeline', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      hands: { a: [T(6, 7), T(7, 8)], b: [] },
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 6), 0, 6)],
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
    let state = makeGame(round, { houseRules: manual, id: 'ABC123' });
    let doc = onlineDoc(state, [T(6, 7), T(7, 8)]);

    const chart = prepareOnlineAction(
      doc,
      'a',
      {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      },
      { a: [T(6, 7), T(7, 8)], b: [] }
    );
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.nextState.round?.activePlayerId).toBe('a');
    expect(chart.nextState.round?.playedThisTurn).toBe(true);
    expect(chart.publicDoc.round?.playedThisTurn).toBe(true);

    const raised = prepareOnlineAction(
      chart.publicDoc,
      'a',
      { type: 'RAISE_SHIELDS', playerId: 'a' },
      { a: [T(7, 8)], b: [] }
    );
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;
    expect(
      raised.nextState.round?.table.warpTrails.a.distressBeacon.active
    ).toBe(false);

    const pass = prepareOnlineAction(
      raised.publicDoc,
      'a',
      { type: 'PASS_TURN', playerId: 'a' },
      { a: [T(7, 8)], b: [] }
    );
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;
    expect(pass.nextState.round?.activePlayerId).toBe('b');
    expect(pass.publicDoc.round?.handCounts?.a).toBe(1);
  });

  it('enforces one shield change per turn through the online round-trip', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      hands: { a: [T(6, 7), T(2, 3)], b: [] },
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 6), 0, 6)],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
      },
    });
    const state = makeGame(round, { houseRules: manual, id: 'ABC123' });
    const doc = onlineDoc(state, [T(6, 7), T(2, 3)]);

    // Voluntary open (one shield change) — survives serialize into publicDoc.
    const open = prepareOnlineAction(
      doc,
      'a',
      { type: 'DEPLOY_DISTRESS_BEACON', playerId: 'a' },
      { a: [T(6, 7), T(2, 3)], b: [] }
    );
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    expect(open.publicDoc.round?.shieldChangedThisTurn).toBe(true);

    // Chart own trail — earns the close gate, but does not reset the per-turn cap.
    const chart = prepareOnlineAction(
      open.publicDoc,
      'a',
      {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      },
      { a: [T(6, 7), T(2, 3)], b: [] }
    );
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(
      chart.publicDoc.round?.table.warpTrails.find((t) => t.playerId === 'a')
        ?.distressBeaconChartedOwnTrailSinceDown
    ).toBe(true);

    // Second shield change this turn is rejected across the round-trip.
    const raise = prepareOnlineAction(
      chart.publicDoc,
      'a',
      { type: 'RAISE_SHIELDS', playerId: 'a' },
      { a: [T(2, 3)], b: [] }
    );
    expect(raise).toEqual({
      ok: false,
      violation: 'RAISE_SHIELDS_NOT_ALLOWED',
    });
  });

  it('rejects RAISE_SHIELDS when manual shield control is off', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      hands: { a: [T(1, 2)], b: [] },
      table: createInitialTable(['a', 'b'], 12, 'a'),
    });
    const state = makeGame(round, { id: 'ABC123' });
    const doc = onlineDoc(state, [T(1, 2)]);

    const result = prepareOnlineAction(
      doc,
      'a',
      { type: 'RAISE_SHIELDS', playerId: 'a' },
      { a: [T(1, 2)], b: [] }
    );
    expect(result).toEqual({ ok: false, violation: 'RAISE_SHIELDS_NOT_ALLOWED' });
  });

  it('accumulates a shared per-round move log across all action types', () => {
    // A full manual-shield turn (chart → raise shields → pass) exercises three
    // distinct action types; the shared move log must capture every one so all
    // clients render the complete log, not just charts.
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      hands: { a: [T(6, 7), T(7, 8)], b: [] },
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 6), 0, 6)],
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
    const state = makeGame(round, { houseRules: manual, id: 'ABC123' });
    const doc = onlineDoc(state, [T(6, 7), T(7, 8)]);

    const chart = prepareOnlineAction(
      doc,
      'a',
      {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      },
      { a: [T(6, 7), T(7, 8)], b: [] }
    );
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.publicDoc.round?.moveLog?.[0]).toMatchObject({
      actorId: 'a',
      source: 'human',
      entry: { kind: 'CHART_COORDINATE', captainId: 'a' },
    });

    const raised = prepareOnlineAction(
      chart.publicDoc,
      'a',
      { type: 'RAISE_SHIELDS', playerId: 'a' },
      { a: [T(7, 8)], b: [] }
    );
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;

    const pass = prepareOnlineAction(
      raised.publicDoc,
      'a',
      { type: 'PASS_TURN', playerId: 'a' },
      { a: [T(7, 8)], b: [] }
    );
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;

    const log = pass.publicDoc.round?.moveLog ?? [];
    expect(log.map((move) => move.entry?.kind)).toEqual([
      'CHART_COORDINATE',
      'RAISE_SHIELDS',
      'PASS_TURN',
    ]);
    expect(log.every((move) => move.actorId === 'a')).toBe(true);
  });
});

describe('house rules feedback integration', () => {
  const impulse = resolveHouseRules({ dropToImpulseCall: true });

  function soundSnapshot(
    round: NonNullable<ReturnType<typeof makeGame>['round']>
  ) {
    return {
      gamePhase: 'active',
      roundPhase: round.phase,
      isMyTurn: true,
      doublesOnTable: 0,
      chartedTileCount: round.table.warpTrails.a.tiles.length,
      trueRedAlert: false,
      redAlertResponsibleId: null,
      activeBeaconCount: 0,
      qFlashActive: false,
      allStopDeclared: false,
      allStopRequired: false,
      activePlayerId: round.activePlayerId,
      dropToImpulseCallPending: round.dropToImpulseCallPending,
      dropToImpulseCatchable: round.dropToImpulseCatchable,
      unchartedSectorCount: round.unchartedSectors.length,
      turnBeepsEnabled: true,
    };
  }

  it('plays return to warp and logs the draw when stuck at impulse online', () => {
    const beforeRound = makeRound(['a', 'b'], {
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
    const before = makeGame(beforeRound, { houseRules: impulse });
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

    const sounds = detectGameSoundTransitions(
      soundSnapshot(before.round!),
      soundSnapshot(draw.state.round!)
    );
    expect(sounds.play).toContain('returnToWarp');
  });
});

describe('combined house rules scenario', () => {
  it('supports manual shields with drop to impulse and pass red alert without draw', () => {
    const rules = resolveHouseRules({
      manualShieldControl: true,
      dropToImpulseCall: true,
      passRedAlertWithoutDraw: true,
    });

    const redAlertRound = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      hands: { a: [T(1, 2)], b: [] },
      unchartedSectors: [T(3, 4)],
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 6), 0, 6)],
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
          anchor: placed(T(6, 6), 0, 6),
          responsiblePlayerId: 'a',
          trailPlayerId: 'a',
        },
      },
    });
    const passAlert = applyAction(makeGame(redAlertRound, { houseRules: rules }), {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(passAlert.ok).toBe(true);
    if (!passAlert.ok) return;
    expect(passAlert.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
      false
    );

    const impulseRound = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(12, 5), T(5, 3)], b: [] },
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(12, 6), 0, 12)],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
      },
    });
    const chart = applyAction(makeGame(impulseRound, { houseRules: rules }), {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.state.round?.dropToImpulseCallPending).toBe('a');
    expect(chart.state.round?.activePlayerId).toBe('a');
    expect(chart.state.round?.playedThisTurn).toBe(false);
  });
});
