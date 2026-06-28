import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { getLegalMoves } from './legal-moves.js';
import { resolveDeadRedAlert } from './dead-red-alert.js';
import {
  endBlockedRound,
  isRoundBlocked,
  maybeEndBlockedRound,
} from './round-resolution.js';
import { scoreRound } from './scoring.js';
import {
  collectRoundCoordinatesForRecycle,
  createRoundStateFromDeal,
  dealRoundFromShuffled,
  startGame,
} from '../setup/create-game.js';
import {
  assertCoordinateSetSize,
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { coordinateKey } from '../types/coordinate.js';
import { resolveModules, DEFAULT_MODULES } from '../types/modules.js';
import {
  allTilesWithPip,
  makeGame,
  makeRound,
  placed,
  T,
} from './test-helpers.js';
import { createInitialTable } from '../table/table-state.js';

describe('tile recycle integrity', () => {
  it('recycles each tile exactly once after a normal deal', () => {
    const deal = dealRoundFromShuffled({
      roundNumber: 1,
      captains: [
        { id: 'a', displayName: 'A', penaltyScore: 0 },
        { id: 'b', displayName: 'B', penaltyScore: 0 },
      ],
      turnOrder: ['a', 'b'],
      shuffledCoordinates: generateCoordinateSet(12),
    });
    assertCoordinateSetSize(collectRoundCoordinatesForRecycle(createRoundStateFromDeal(deal)));
  });

  it('does not duplicate fracture anchor or red-alert anchor already on trails', () => {
    const anchor = placed(T(5, 5), 0, 5);
    const round = makeRound(['a', 'b'], {
      hands: { a: [T(1, 2)], b: [T(3, 4)] },
      unchartedSectors: [T(7, 8)],
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [anchor, placed(T(5, 3), 1, 3)],
            distressBeacon: { active: false },
          },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        subspaceFracture: {
          active: false,
          anchor,
          stabilizers: [placed(T(5, 1), 0, 1)],
          requiredValue: 5,
        },
        redAlert: {
          active: true,
          anchor,
          responsiblePlayerId: 'a',
          trailPlayerId: 'a',
        },
      },
    });

    const recycled = collectRoundCoordinatesForRecycle(round);
    const keys = recycled.map(coordinateKey);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it('recycles exactly 91 tiles after a real subspace fracture via the engine', () => {
    const shuffled = shuffleCoordinates(generateCoordinateSet(12), () => 0.5);
    let state = startGame(
      {
        id: 'fracture-recycle',
        captains: [
          { id: 'a', displayName: 'A' },
          { id: 'b', displayName: 'B' },
        ],
        modules: { subspaceFracture: true },
      },
      { shuffledCoordinates: shuffled }
    );

    let fractured = false;
    for (let step = 0; step < 120 && !fractured; step++) {
      const round = state.round!;
      const playerId = round.activePlayerId;
      const moves = getLegalMoves(round, playerId);
      const ownDouble = moves.find(
        (move) =>
          move.coordinate.low === move.coordinate.high &&
          move.route.kind === 'warp-trail' &&
          move.route.playerId === playerId
      );
      if (ownDouble) {
        const result = applyAction(state, {
          type: 'CHART_COORDINATE',
          playerId,
          coordinate: ownDouble.coordinate,
          route: ownDouble.route,
        });
        if (result.ok && result.state.round?.table.subspaceFracture?.active) {
          state = result.state;
          fractured = true;
          break;
        }
        if (result.ok) {
          state = result.state;
          continue;
        }
      }
      const fallback = moves[0];
      if (fallback) {
        const result = applyAction(state, {
          type: 'CHART_COORDINATE',
          playerId,
          coordinate: fallback.coordinate,
          route: fallback.route,
        });
        if (result.ok) {
          state = result.state;
          continue;
        }
      }
      const draw = applyAction(state, {
        type: 'DRAW_FROM_UNCHARTED',
        playerId,
      });
      if (!draw.ok) break;
      state = draw.state;
    }

    expect(fractured).toBe(true);
    assertCoordinateSetSize(collectRoundCoordinatesForRecycle(state.round!));
  });
});

describe('dead double (Red Alert release)', () => {
  it('clears Red Alert when every tile with that pip is charted', () => {
    const sixes = allTilesWithPip(6);
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: sixes.map((coordinate, index) =>
              placed(coordinate, index, 6)
            ),
            distressBeacon: { active: false },
          },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        redAlert: {
          active: true,
          anchor: placed(T(6, 6), sixes.findIndex((c) => c.low === 6 && c.high === 6), 6),
          responsiblePlayerId: 'a',
          trailPlayerId: 'a',
        },
      },
    });

    expect(resolveDeadRedAlert(round).table.redAlert).toBeNull();
  });

  it('unlocks non-cover routes for other captains once the double is dead', () => {
    const sixes = allTilesWithPip(6);
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'b',
      hands: {
        a: [],
        b: [T(6, 7)],
      },
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: sixes.map((coordinate, index) =>
              placed(coordinate, index, 6)
            ),
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [placed(T(7, 7), 0, 7)],
            distressBeacon: { active: false },
          },
        },
        redAlert: {
          active: true,
          anchor: placed(T(6, 6), sixes.findIndex((c) => c.low === 6 && c.high === 6), 6),
          responsiblePlayerId: 'a',
          trailPlayerId: 'a',
        },
      },
    });

    const moves = getLegalMoves(round, 'b');
    expect(moves.some((move) => move.route.kind === 'warp-trail')).toBe(true);
    expect(moves.every((move) => move.route.kind === 'red-alert-cover')).toBe(
      false
    );
  });
});

describe('blocked sector (empty draw pile, no legal charts)', () => {
  it('detects a blocked round when nobody can play and the pile is empty', () => {
    const round = makeRound(['a', 'b'], {
      unchartedSectors: [],
      hands: {
        a: [T(1, 2)],
        b: [T(3, 4)],
      },
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(12, 5), 0, 5)],
            distressBeacon: { active: true },
          },
          b: {
            playerId: 'b',
            tiles: [placed(T(12, 7), 0, 7)],
            distressBeacon: { active: true },
          },
        },
      },
    });

    expect(isRoundBlocked(round)).toBe(true);
  });

  it('does not block while Uncharted Sectors remain', () => {
    const round = makeRound(['a', 'b'], {
      unchartedSectors: [T(0, 1)],
      hands: { a: [T(1, 2)], b: [T(3, 4)] },
    });
    expect(isRoundBlocked(round)).toBe(false);
  });

  it('ends the sector after a pass when the pile is empty and nobody can play', () => {
    let state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        unchartedSectors: [],
        hands: { a: [T(1, 2)], b: [T(3, 4)] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(T(12, 5), 0, 5)],
              distressBeacon: { active: true },
            },
            b: {
              playerId: 'b',
              tiles: [placed(T(12, 7), 0, 7)],
              distressBeacon: { active: true },
            },
          },
        },
      })
    );

    const pass = applyAction(state, { type: 'PASS_TURN', playerId: 'a' });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;

    state = pass.state;
    expect(state.round?.phase).toBe('ended');
    expect(state.round?.roundBlocked).toBe(true);
    expect(state.round?.roundWinnerId).toBe(null);
  });

  it('scores every captain on a blocked sector', () => {
    const round = endBlockedRound(
      makeRound(['a', 'b', 'c'], {
        roundNumber: 13,
        hands: {
          a: [T(1, 2)],
          b: [T(3, 4)],
          c: [T(5, 6)],
        },
      })
    );

    const state = makeGame(round, {
      completedRounds: 12,
      captains: [
        { id: 'a', displayName: 'A', penaltyScore: 0 },
        { id: 'b', displayName: 'B', penaltyScore: 10 },
        { id: 'c', displayName: 'C', penaltyScore: 0 },
      ],
    });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.captains.find((c) => c.id === 'a')?.penaltyScore).toBe(3);
    expect(result.state.captains.find((c) => c.id === 'b')?.penaltyScore).toBe(
      17
    );
    expect(result.state.captains.find((c) => c.id === 'c')?.penaltyScore).toBe(
      11
    );
  });

  it('accepts END_ROUND with a null winner when the sector is blocked', () => {
    const round = endBlockedRound(
      makeRound(['a', 'b'], { roundNumber: 13 })
    );
    const state = makeGame(round, { completedRounds: 12 });
    const result = applyAction(state, { type: 'END_ROUND', winnerId: null });
    expect(result.ok).toBe(true);
  });
});

describe('mandatory play after drawing', () => {
  it('sets mandatoryPlay instead of auto-charting when multiple routes exist', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 12,
        unchartedSectors: [T(6, 12)],
        hands: { a: [], b: [] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [placed(T(12, 5), 0, 5)],
              distressBeacon: { active: true },
            },
          },
        },
      })
    );

    const draw = applyAction(state, { type: 'DRAW_FROM_UNCHARTED', playerId: 'a' });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;

    expect(draw.state.round?.mandatoryPlay).toEqual({
      playerId: 'a',
      coordinate: T(6, 12),
    });
    const moves = getLegalMoves(draw.state.round!, 'a');
    expect(moves.length).toBeGreaterThan(1);
  });

  it('clears mandatoryPlay after the drawn tile is charted', () => {
    let state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        unchartedSectors: [T(6, 12)],
        hands: { a: [], b: [] },
      })
    );

    const draw = applyAction(state, { type: 'DRAW_FROM_UNCHARTED', playerId: 'a' });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    state = draw.state;

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(6, 12),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.state.round?.mandatoryPlay).toBeNull();
  });

  it('sets mandatoryPlay even when the drawn tile has only one legal route', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        unchartedSectors: [T(5, 5)],
        hands: { a: [], b: [T(1, 2)] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(T(12, 5), 0, 5)],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
        },
      })
    );

    const draw = applyAction(state, { type: 'DRAW_FROM_UNCHARTED', playerId: 'a' });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;

    expect(draw.state.round?.mandatoryPlay?.coordinate).toEqual(T(5, 5));
    expect(getLegalMoves(draw.state.round!, 'a')).toHaveLength(1);
  });

  it('rejects FORFEIT_IMPULSE when Uncharted Sectors are empty', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        unchartedSectors: [],
        treatyDeclarationRequired: true,
        roundWinnerId: 'a',
      })
    );

    const result = applyAction(state, {
      type: 'FORFEIT_IMPULSE',
      playerId: 'a',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation).toBe('EMPTY_UNCHARTED');
  });
});

describe('dropping to impulse (treaty / penalty)', () => {
  it('requires DECLARE_TREATY after a Neutral Zone win', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: { a: [T(4, 12)], b: [T(1, 2)] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          neutralZone: {
            tiles: [placed(T(5, 12), 0, 12)],
          },
        },
      })
    );

    const win = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(4, 12),
      route: { kind: 'neutral-zone' },
    });
    expect(win.ok).toBe(true);
    if (!win.ok) return;

    expect(win.state.round?.roundWinnerId).toBe('a');
    expect(win.state.round?.treatyDeclarationRequired).toBe(true);
    expect(win.state.round?.phase).toBe('playing');
  });

  it('FORFEIT_IMPULSE draws a penalty tile and resumes play without ending the sector', () => {
    let state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: { a: [], b: [T(1, 2)] },
        unchartedSectors: [T(3, 4), T(5, 6)],
        treatyDeclarationRequired: true,
        treatyDeclared: false,
        roundWinnerId: 'a',
      })
    );

    const forfeit = applyAction(state, {
      type: 'FORFEIT_IMPULSE',
      playerId: 'a',
    });
    expect(forfeit.ok).toBe(true);
    if (!forfeit.ok) return;

    expect(forfeit.state.round?.roundWinnerId).toBeNull();
    expect(forfeit.state.round?.treatyDeclarationRequired).toBe(false);
    expect(forfeit.state.round?.phase).toBe('playing');
    expect(forfeit.state.round?.hands.a).toHaveLength(1);
    expect(forfeit.state.round?.unchartedSectors).toHaveLength(1);
    expect(forfeit.state.round?.activePlayerId).toBe('b');
  });

  it('DECLARE_TREATY closes the sector after a Neutral Zone win', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: { a: [], b: [T(1, 2)] },
        treatyDeclarationRequired: true,
        treatyDeclared: false,
        roundWinnerId: 'a',
      })
    );

    const treaty = applyAction(state, {
      type: 'DECLARE_TREATY',
      playerId: 'a',
    });
    expect(treaty.ok).toBe(true);
    if (!treaty.ok) return;
    expect(treaty.state.round?.phase).toBe('ended');
    expect(treaty.state.round?.treatyDeclared).toBe(true);
  });
});

describe('module defaults', () => {
  it('keeps Subspace Fracture off unless explicitly enabled', () => {
    expect(DEFAULT_MODULES.subspaceFracture.enabled).toBe(false);
    expect(resolveModules({}).subspaceFracture.enabled).toBe(false);
    expect(resolveModules({ subspaceFracture: true }).subspaceFracture.enabled).toBe(
      true
    );
  });
});

describe('maybeEndBlockedRound', () => {
  it('leaves an active round unchanged when charts remain', () => {
    const round = makeRound(['a', 'b'], {
      unchartedSectors: [],
      hands: { a: [T(12, 5)], b: [T(3, 4)] },
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [placed(T(12, 7), 0, 7)],
            distressBeacon: { active: false },
          },
        },
      },
    });

    expect(maybeEndBlockedRound(round).phase).toBe('playing');
  });
});
