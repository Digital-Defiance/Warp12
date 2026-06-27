import { describe, expect, it } from 'vitest';

import { applyAction } from '../engine/apply-action.js';
import { canPassRedAlert, canPassTurn } from '../engine/beacon.js';
import { getLegalMoves } from '../engine/legal-moves.js';
import { createLobbyState } from '../setup/create-game.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import type { GameState, RoundState } from '../types/game-state.js';

import { toGameAction } from './actions.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { getWarpSkillProfile } from './skill.js';
import {
  makeRound,
  modulesWithQ,
  N,
  obsFor,
  tableWithOwnTrail,
  TEST_CAPTAINS,
} from './test-fixtures.js';

const THREE_TURN = ['a', 'b', 'c'] as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stateFromRound(round: RoundState, modules = DEFAULT_MODULES): GameState {
  return {
    ...createLobbyState({
      id: 'scenario',
      captains: TEST_CAPTAINS.map((captain) => ({
        id: captain.id,
        displayName: captain.displayName,
      })),
    }),
    phase: 'active',
    modules,
    round,
  };
}

function redAlertTable(responsible: string, trailPlayer: string) {
  const anchor = {
    coordinate: N(6, 6),
    index: 0,
    openValue: 6,
  };
  return {
    warpTrails: {
      a: {
        playerId: 'a',
        tiles: [anchor],
        distressBeacon: { active: false },
      },
      b: {
        playerId: 'b',
        tiles: [],
        distressBeacon: { active: false },
      },
      c: {
        playerId: 'c',
        tiles: [],
        distressBeacon: { active: false },
      },
    },
    neutralZone: { tiles: [] },
    subspaceFracture: null,
    redAlert: {
      active: true,
      anchor,
      responsiblePlayerId: responsible,
      trailPlayerId: trailPlayer,
    },
    spacedock: { value: 6, placedBy: 'a' },
  };
}

describe('scenario — red alert pass chain', () => {
  it('passes responsibility along turn order and deploys each captain beacon', () => {
    let state = stateFromRound(
      makeRound({
        turnOrder: [...THREE_TURN],
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: {
          a: [N(1, 2)],
          b: [N(3, 4)],
          c: [N(5, 7)],
        },
        unchartedSectors: [],
        table: redAlertTable('a', 'a') as RoundState['table'],
      })
    );

    expect(canPassRedAlert(state.round!, 'a')).toBe(true);

    const passA = applyAction(state, { type: 'PASS_RED_ALERT', playerId: 'a' });
    expect(passA.ok).toBe(true);
    if (!passA.ok) return;
    state = passA.state;
    expect(state.round?.table.redAlert?.responsiblePlayerId).toBe('b');
    expect(state.round?.table.warpTrails.a.distressBeacon.active).toBe(true);
    expect(state.round?.activePlayerId).toBe('b');

    const passB = applyAction(state, { type: 'PASS_RED_ALERT', playerId: 'b' });
    expect(passB.ok).toBe(true);
    if (!passB.ok) return;
    state = passB.state;
    expect(state.round?.table.redAlert?.responsiblePlayerId).toBe('c');
    expect(state.round?.table.warpTrails.b.distressBeacon.active).toBe(true);
    expect(state.round?.activePlayerId).toBe('c');
  });
});

describe('scenario — treaty declaration gate', () => {
  it('keeps the round open until the winner declares', () => {
    const round = makeRound({
      hands: { a: [], b: [N(1, 2)] },
      treatyDeclarationRequired: true,
      treatyDeclared: false,
      roundWinnerId: 'a',
      activePlayerId: 'a',
      phase: 'playing',
    });
    const state = stateFromRound(round);

    expect(getLegalMoves(round, 'a')).toHaveLength(0);
    expect(warpCandidateGenerator(obsFor(round))).toEqual([
      { kind: 'declare-treaty' },
    ]);

    const draw = applyAction(state, { type: 'DRAW_FROM_UNCHARTED', playerId: 'a' });
    expect(draw.ok).toBe(false);

    const declare = applyAction(state, { type: 'DECLARE_TREATY', playerId: 'a' });
    expect(declare.ok).toBe(true);
    if (declare.ok) {
      expect(declare.state.round?.phase).toBe('ended');
      expect(declare.state.round?.treatyDeclared).toBe(true);
    }
  });
});

describe('scenario — distress beacon pass turn', () => {
  it('allows passing when shields are down and the pile is empty', () => {
    const round = makeRound({
      hands: { a: [N(1, 2)], b: [] },
      unchartedSectors: [],
      table: {
        ...tableWithOwnTrail('a', N(6, 6), 6),
        warpTrails: {
          ...tableWithOwnTrail('a', N(6, 6), 6).warpTrails,
          a: {
            playerId: 'a',
            tiles: [{ coordinate: N(6, 6), index: 0, openValue: 6 }],
            distressBeacon: { active: true },
          },
        },
        spacedock: { value: 6, placedBy: 'a' },
      },
      spacedockValue: 6,
    });

    expect(canPassTurn(round, 'a')).toBe(true);
    expect(warpCandidateGenerator(obsFor(round))).toEqual([{ kind: 'pass-turn' }]);

    const result = applyAction(stateFromRound(round), {
      type: 'PASS_TURN',
      playerId: 'a',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.round?.activePlayerId).toBe('b');
    }
  });
});

describe('scenario — candidate generator control paths', () => {
  it('surfaces Q-Flash resolution when the invoker is pending', () => {
    const round = makeRound({
      qPendingInvoker: 'a',
      hands: { a: [N(0, 1)], b: [] },
    });
    const candidates = warpCandidateGenerator(
      obsFor(round, modulesWithQ()),
      { rng: () => 0 }
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('invoke-q-flash');
  });

  it('surfaces Q gamble resolution when a gamble is pending', () => {
    const round = makeRound({
      qGamblePending: { playerId: 'a', options: [N(2, 3), N(10, 11)] },
    });
    const candidates = warpCandidateGenerator(obsFor(round, modulesWithQ()));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('resolve-q-gamble');
  });

  it('offers pass-red-alert when blocked and stuck with an empty pile', () => {
    const round = makeRound({
      spacedockValue: 6,
      hands: { a: [N(1, 2)], b: [] },
      unchartedSectors: [],
      table: redAlertTable('a', 'a') as RoundState['table'],
    });
    expect(warpCandidateGenerator(obsFor(round))).toEqual([
      { kind: 'pass-red-alert' },
    ]);
  });
});

describe('scenario — AI red alert pass', () => {
  it('chooses pass-red-alert when that is the only legal resolution', () => {
    const round = makeRound({
      spacedockValue: 6,
      hands: { a: [N(1, 2)], b: [] },
      unchartedSectors: [],
      table: redAlertTable('a', 'a') as RoundState['table'],
    });
    const player = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      rng: mulberry32(99),
    });

    const action = player.decide(obsFor(round));
    expect(action.kind).toBe('pass-red-alert');
    expect(
      applyAction(stateFromRound(round), toGameAction(action, 'a')).ok
    ).toBe(true);
  });
});
