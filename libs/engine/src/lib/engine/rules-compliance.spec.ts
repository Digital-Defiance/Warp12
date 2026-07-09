import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { getLegalMoves } from './legal-moves.js';
import { resolveDeadRedAlert } from './dead-red-alert.js';
import { isPipExhausted } from '../table/pip-inventory.js';
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
import { resolveHouseRules } from '../types/house-rules.js';
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
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
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

  it('deals a full Uncharted pile after scoring a normal blocked round', () => {
    const captains = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({
      id,
      displayName: id,
      pointsScore: 0,
    }));
    const deal = dealRoundFromShuffled({
      roundNumber: 2,
      captains,
      turnOrder: captains.map((c) => c.id),
      shuffledCoordinates: generateCoordinateSet(12),
    });
    const endedRound = endBlockedRound(createRoundStateFromDeal(deal));

    assertCoordinateSetSize(collectRoundCoordinatesForRecycle(endedRound));

    const state = makeGame(endedRound, {
      completedRounds: 1,
      campaignRounds: 5,
      captains,
    });
    const scored = scoreRound(state, endedRound, () => 0.5);
    expect(scored.ok).toBe(true);
    if (!scored.ok) {
      return;
    }

    expect(scored.state.round?.roundNumber).toBe(3);
    expect(scored.state.round?.unchartedSectors.length).toBe(18);
    assertCoordinateSetSize(
      collectRoundCoordinatesForRecycle(scored.state.round!)
    );
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

  it('archives partial stabilizers when a dead double dismisses an active fracture', () => {
    const twos = allTilesWithPip(2);
    const anchor = placed(T(2, 2), 8, 2);
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      hands: { a: [], b: [] },
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [
              ...twos
                .filter((c) => !(c.low === 2 && c.high === 2))
                .map((coordinate, index) => placed(coordinate, index, 2)),
              anchor,
            ],
            distressBeacon: { active: false },
          },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        subspaceFracture: {
          active: true,
          anchor,
          stabilizers: [placed(T(2, 10), 0, 2), placed(T(2, 4), 1, 2)],
          requiredValue: 2,
          trailCaptainId: 'a',
        },
        redAlert: {
          active: true,
          anchor,
          responsiblePlayerId: 'b',
          trailPlayerId: 'a',
        },
      },
    });

    const countTiles = (state: typeof round) =>
      state.unchartedSectors.length +
      (state.hands.a?.length ?? 0) +
      (state.hands.b?.length ?? 0) +
      state.table.warpTrails.a.tiles.length +
      state.table.warpTrails.b.tiles.length +
      (state.table.subspaceFracture?.stabilizers.length ?? 0) +
      1;

    expect(countTiles(round)).toBe(16);

    const resolved = resolveDeadRedAlert(round);
    expect(resolved.table.redAlert).toBeNull();
    expect(resolved.table.subspaceFracture).toBeNull();
    expect(resolved.table.warpTrails.a.tiles).toHaveLength(15);
    expect(countTiles(resolved)).toBe(16);
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

  it('does not open Red Alert or Subspace Fracture when the double pip is dead', () => {
    const deadDouble = T(6, 6);
    const sixes = allTilesWithPip(6);
    const otherSixes = sixes.filter(
      (coordinate) =>
        !(coordinate.low === deadDouble.low && coordinate.high === deadDouble.high)
    );

    let state = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: { a: [deadDouble], b: [] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: otherSixes.map((coordinate, index) =>
                placed(coordinate, index, 6)
              ),
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [placed(T(12, 6), 0, 6)],
              distressBeacon: { active: true },
            },
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true, subspaceFractureScope: 'all-doubles' }) }
    );

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: deadDouble,
      route: { kind: 'warp-trail', playerId: 'b' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    expect(chart.state.round?.table.redAlert).toBeNull();
    expect(chart.state.round?.table.subspaceFracture).toBeNull();
    expect(
      getLegalMoves(chart.state.round!, 'a').some(
        (move) => move.route.kind === 'fracture-stabilizer'
      )
    ).toBe(false);
  });

  it('opens Red Alert on 12-12 while twelves remain in hands (not dead)', () => {
    const twelves = allTilesWithPip(12);
    const doubleTwelve = T(12, 12);
    const offTable = new Set(
      [doubleTwelve, T(0, 12), T(4, 12)].map((c) => coordinateKey(c))
    );
    const chartedTwelves = twelves.filter(
      (coordinate) => !offTable.has(coordinateKey(coordinate))
    );

    let state = makeGame(
      makeRound(['a', 'b', 'c'], {
        spacedockValue: 11,
        activePlayerId: 'a',
        hands: {
          a: [doubleTwelve, T(0, 12)],
          b: [T(4, 12)],
          c: [],
        },
        table: {
          ...createInitialTable(['a', 'b', 'c'], 11, 'a'),
          warpTrails: {
            a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
            b: {
              playerId: 'b',
              tiles: [placed(T(11, 12), 0, 12)],
              distressBeacon: { active: true },
            },
            c: { playerId: 'c', tiles: [], distressBeacon: { active: false } },
          },
          neutralZone: {
            tiles: chartedTwelves.map((coordinate, index) =>
              placed(coordinate, index, 12)
            ),
          },
        },
      })
    );

    expect(isPipExhausted(state.round!, 12)).toBe(false);

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: doubleTwelve,
      route: { kind: 'warp-trail', playerId: 'b' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    expect(chart.state.round?.table.redAlert?.active).toBe(true);
    expect(chart.state.round?.activePlayerId).toBe('a');
    expect(
      getLegalMoves(chart.state.round!, 'a').some(
        (move) =>
          move.route.kind === 'red-alert-cover' &&
          move.coordinate.low === 0 &&
          move.coordinate.high === 12
      )
    ).toBe(true);
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

  it('detects a fracture deadlock when no hand holds the stabilizer pip', () => {
    const anchor = placed(T(5, 5), 2, 5);
    const round = makeRound(['a', 'b', 'c'], {
      activePlayerId: 'a',
      unchartedSectors: [],
      hands: {
        a: [T(1, 3)],
        b: [T(0, 8)],
        c: [T(2, 7)],
      },
      table: {
        ...createInitialTable(['a', 'b', 'c'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(12, 2), 0, 2)],
            distressBeacon: { active: true },
          },
          b: {
            playerId: 'b',
            tiles: [
              placed(T(1, 12), 0, 1),
              placed(T(1, 5), 1, 5),
              anchor,
            ],
            distressBeacon: { active: true },
          },
          c: {
            playerId: 'c',
            tiles: [placed(T(12, 7), 0, 7)],
            distressBeacon: { active: false },
          },
        },
        subspaceFracture: {
          active: true,
          anchor,
          stabilizers: [placed(T(3, 5), 0, 3), placed(T(0, 5), 1, 0)],
          requiredValue: 5,
          trailCaptainId: 'b',
        },
        redAlert: {
          active: true,
          anchor,
          responsiblePlayerId: 'a',
          trailPlayerId: 'b',
        },
      },
    });

    expect(isRoundBlocked(round)).toBe(true);
  });

  it('does not block a fracture while any hand still holds the stabilizer pip', () => {
    const anchor = placed(T(5, 5), 2, 5);
    const round = makeRound(['a', 'b', 'c'], {
      unchartedSectors: [],
      hands: {
        a: [T(1, 3)],
        b: [T(0, 8)],
        c: [T(5, 9)],
      },
      table: {
        ...createInitialTable(['a', 'b', 'c'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(12, 2), 0, 2)],
            distressBeacon: { active: true },
          },
          b: {
            playerId: 'b',
            tiles: [
              placed(T(1, 12), 0, 1),
              placed(T(1, 5), 1, 5),
              anchor,
            ],
            distressBeacon: { active: true },
          },
          c: {
            playerId: 'c',
            tiles: [placed(T(12, 7), 0, 7)],
            distressBeacon: { active: false },
          },
        },
        subspaceFracture: {
          active: true,
          anchor,
          stabilizers: [placed(T(3, 5), 0, 3), placed(T(0, 5), 1, 0)],
          requiredValue: 5,
          trailCaptainId: 'b',
        },
        redAlert: {
          active: true,
          anchor,
          responsiblePlayerId: 'a',
          trailPlayerId: 'b',
        },
      },
    });

    expect(isRoundBlocked(round)).toBe(false);
  });

  it('ignores a skipped captain stabilizer tile when detecting fracture deadlock', () => {
    const anchor = placed(T(5, 5), 2, 5);
    const round = makeRound(['a', 'b', 'c'], {
      activePlayerId: 'a',
      unchartedSectors: [],
      hands: {
        a: [T(1, 3)],
        b: [T(0, 8)],
        c: [T(5, 9)],
      },
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: ['c'],
        peekedSector: null,
        salamanderSwap: false,
        allStopEcho: false,
      },
      table: {
        ...createInitialTable(['a', 'b', 'c'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(12, 2), 0, 2)],
            distressBeacon: { active: true },
          },
          b: {
            playerId: 'b',
            tiles: [
              placed(T(1, 12), 0, 1),
              placed(T(1, 5), 1, 5),
              anchor,
            ],
            distressBeacon: { active: true },
          },
          c: {
            playerId: 'c',
            tiles: [placed(T(12, 7), 0, 7)],
            distressBeacon: { active: false },
          },
        },
        subspaceFracture: {
          active: true,
          anchor,
          stabilizers: [placed(T(3, 5), 0, 3), placed(T(0, 5), 1, 0)],
          requiredValue: 5,
          trailCaptainId: 'b',
        },
        redAlert: {
          active: true,
          anchor,
          responsiblePlayerId: 'a',
          trailPlayerId: 'b',
        },
      },
    });

    expect(isRoundBlocked(round)).toBe(true);
  });

  it('ends the sector after pass Red Alert when only a skipped captain holds the stabilizer pip', () => {
    const anchor = placed(T(8, 8), 1, 8);
    let state = makeGame(
      makeRound(['a', 'b', 'c', 'd'], {
        activePlayerId: 'b',
        unchartedSectors: [],
        hands: {
          a: [T(3, 8)],
          b: [T(1, 3)],
          c: [T(4, 5)],
          d: [T(6, 7)],
        },
        continuumEffects: {
          reverseTurnOrder: false,
          temporalInversion: false,
          openAllTrails: false,
          suppressNextFracture: false,
          skipNextTurnFor: ['a'],
          peekedSector: null,
          salamanderSwap: false,
          allStopEcho: false,
        },
        table: {
          ...createInitialTable(['a', 'b', 'c', 'd'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(T(11, 12), 0, 11)],
              distressBeacon: { active: true },
            },
            b: {
              playerId: 'b',
              tiles: [placed(T(11, 1), 0, 1), anchor],
              distressBeacon: { active: false },
            },
            c: {
              playerId: 'c',
              tiles: [placed(T(11, 4), 0, 4)],
              distressBeacon: { active: true },
            },
            d: {
              playerId: 'd',
              tiles: [placed(T(11, 6), 0, 6)],
              distressBeacon: { active: true },
            },
          },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [placed(T(6, 8), 0, 6)],
            requiredValue: 8,
            trailCaptainId: 'b',
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'b',
            trailPlayerId: 'b',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const pass = applyAction(state, {
      type: 'PASS_RED_ALERT',
      playerId: 'b',
    });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;

    expect(pass.state.round?.phase).toBe('ended');
    expect(pass.state.round?.roundBlocked).toBe(true);
  });

  it('does not block a fracture while Uncharted Sectors remain', () => {
    const anchor = placed(T(5, 5), 2, 5);
    const round = makeRound(['a', 'b'], {
      unchartedSectors: [T(5, 9)],
      hands: { a: [T(1, 3)], b: [T(0, 8)] },
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(12, 2), 0, 2)],
            distressBeacon: { active: true },
          },
          b: {
            playerId: 'b',
            tiles: [placed(T(1, 12), 0, 1), placed(T(1, 5), 1, 5), anchor],
            distressBeacon: { active: true },
          },
        },
        subspaceFracture: {
          active: true,
          anchor,
          stabilizers: [placed(T(3, 5), 0, 3), placed(T(0, 5), 1, 0)],
          requiredValue: 5,
          trailCaptainId: 'b',
        },
        redAlert: {
          active: true,
          anchor,
          responsiblePlayerId: 'a',
          trailPlayerId: 'b',
        },
      },
    });

    expect(isRoundBlocked(round)).toBe(false);
  });

  it('ends the sector after pass Red Alert when the fracture cannot be stabilized', () => {
    const anchor = placed(T(5, 5), 2, 5);
    let state = makeGame(
      makeRound(['a', 'b', 'c'], {
        activePlayerId: 'a',
        unchartedSectors: [],
        hands: {
          a: [T(1, 3)],
          b: [T(0, 8)],
          c: [T(2, 7)],
        },
        table: {
          ...createInitialTable(['a', 'b', 'c'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(T(12, 2), 0, 2)],
              distressBeacon: { active: true },
            },
            b: {
              playerId: 'b',
              tiles: [
                placed(T(1, 12), 0, 1),
                placed(T(1, 5), 1, 5),
                anchor,
              ],
              distressBeacon: { active: true },
            },
            c: {
              playerId: 'c',
              tiles: [placed(T(12, 7), 0, 7)],
              distressBeacon: { active: false },
            },
          },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [placed(T(3, 5), 0, 3), placed(T(0, 5), 1, 0)],
            requiredValue: 5,
            trailCaptainId: 'b',
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'a',
            trailPlayerId: 'b',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const pass = applyAction(state, {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;

    expect(pass.state.round?.phase).toBe('ended');
    expect(pass.state.round?.roundBlocked).toBe(true);
    expect(pass.state.round?.roundWinnerId).toBe(null);
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
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 10 },
        { id: 'c', displayName: 'C', pointsScore: 0 },
      ],
    });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.captains.find((c) => c.id === 'a')?.pointsScore).toBe(3);
    expect(result.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(
      17
    );
    expect(result.state.captains.find((c) => c.id === 'c')?.pointsScore).toBe(
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
});

describe('calling all stop', () => {
  it('auto-declares All Stop and ends the sector after a Neutral Zone win', () => {
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
    expect(win.state.round?.allStopRequired).toBe(true);
    expect(win.state.round?.allStopDeclared).toBe(true);
    expect(win.state.round?.phase).toBe('ended');
  });

  it('ends silently when All Stop ceremony is disabled', () => {
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
      }),
      { houseRules: resolveHouseRules({ allStopCeremony: false }) }
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
    expect(win.state.round?.allStopRequired).toBe(false);
    expect(win.state.round?.allStopDeclared).toBe(false);
    expect(win.state.round?.phase).toBe('ended');
  });

  it('allows RAISE_SHIELDS when manual shield control is enabled', () => {
    const state = {
      ...makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [T(1, 2)], b: [] },
          unchartedSectors: [T(3, 4)],
          table: {
            ...createInitialTable(['a', 'b'], 12, 'a'),
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: [placed(T(12, 6), 0, 6)],
                distressBeacon: { active: true, chartedOwnTrailSinceDown: true },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
          },
        })
      ),
      houseRules: resolveHouseRules({ manualShieldControl: true }),
    };

    const result = applyAction(state, {
      type: 'RAISE_SHIELDS',
      playerId: 'a',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
      false
    );
    expect(result.state.round?.activePlayerId).toBe('a');
  });

  it('rejects RAISE_SHIELDS without manual shield control', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        unchartedSectors: [T(3, 4)],
      })
    );

    const result = applyAction(state, {
      type: 'RAISE_SHIELDS',
      playerId: 'a',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation).toBe('RAISE_SHIELDS_NOT_ALLOWED');
  });

  it('auto-declares All Stop after a warp-trail win when All stop echo is active', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: { a: [T(5, 12)], b: [T(1, 2)] },
        continuumEffects: {
          reverseTurnOrder: false,
          temporalInversion: false,
          openAllTrails: false,
          suppressNextFracture: false,
          skipNextTurnFor: [],
          peekedSector: null,
          salamanderSwap: false,
          allStopEcho: true,
        },
        table: createInitialTable(['a', 'b'], 12, 'a'),
      })
    );

    const win = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(5, 12),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(win.ok).toBe(true);
    if (!win.ok) return;

    expect(win.state.round?.roundWinnerId).toBe('a');
    expect(win.state.round?.allStopRequired).toBe(true);
    expect(win.state.round?.allStopDeclared).toBe(true);
    expect(win.state.round?.phase).toBe('ended');
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
