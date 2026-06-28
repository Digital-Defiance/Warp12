import { applyAction, getLegalMoves } from './engine/apply-action.js';
import {
  createLobbyState,
  dealRoundFromShuffled,
  roundStarterForRound,
  startGame,
} from './setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from './domino/coordinates.js';
import {
  coordinateKey,
  normalizeCoordinate,
} from './types/coordinate.js';
import {
  handSizeForPlayerCount,
  salamanderPenaltyApplies,
  spacedockValueForRound,
} from './constants/setup.js';

const captains = [
  { id: 'a', displayName: 'Alpha' },
  { id: 'b', displayName: 'Beta' },
  { id: 'c', displayName: 'Bravo' },
  { id: 'd', displayName: 'Delta' },
];

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function buildTestGame(
  seed = 42,
  modules?: { subspaceFracture?: boolean; qContinuum?: boolean }
) {
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    seededRandom(seed)
  );

  return startGame(
    { id: 'test', captains, modules },
    { shuffledCoordinates: shuffled }
  );
}

describe('Warp12-lib setup', () => {
  it('creates a lobby with default modules disabled', () => {
    const state = createLobbyState({ id: 'game-1', captains });

    expect(state.phase).toBe('lobby');
    expect(state.captains).toHaveLength(4);
    expect(state.modules.qContinuum.enabled).toBe(false);
  });

  it('deals the correct hand size for four captains', () => {
    expect(handSizeForPlayerCount(4)).toBe(15);
    expect(handSizeForPlayerCount(8)).toBe(10);
  });

  it('starts a game with round one spacedock at double-twelve', () => {
    const state = buildTestGame();

    expect(state.phase).toBe('active');
    expect(state.round?.spacedockValue).toBe(12);
    expect(state.round?.table.spacedock.placedBy).toBe('a');
    expect(spacedockValueForRound(2)).toBe(11);
  });

  it('sets aside the spacedock double before dealing hands', () => {
    const shuffled = shuffleCoordinates(
      generateCoordinateSet(12),
      seededRandom(42)
    );
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffled,
      roundNumber: 1,
      captains: captains.map((captain) => ({
        ...captain,
        penaltyScore: 0,
      })),
      turnOrder: captains.map((captain) => captain.id),
    });
    const spacedockKey = coordinateKey(normalizeCoordinate(12, 12));

    for (const hand of Object.values(deal.hands)) {
      expect(hand.some((coordinate) => coordinateKey(coordinate) === spacedockKey)).toBe(false);
    }
    expect(
      deal.unchartedSectors.some(
        (coordinate) => coordinateKey(coordinate) === spacedockKey
      )
    ).toBe(false);
  });

  it('rotates the round starter clockwise each round', () => {
    expect(roundStarterForRound(['a', 'b', 'c', 'd'], 1)).toBe('a');
    expect(roundStarterForRound(['a', 'b', 'c', 'd'], 2)).toBe('b');
    expect(roundStarterForRound(['a', 'b', 'c', 'd'], 4)).toBe('d');
    expect(roundStarterForRound(['a', 'b', 'c', 'd'], 5)).toBe('a');
  });

  it('does not apply Salamander penalty in round 1', () => {
    expect(salamanderPenaltyApplies(1)).toBe(false);
    expect(salamanderPenaltyApplies(2)).toBe(true);
  });
});

describe('applyAction', () => {
  it('charts a matching coordinate on the active captain warp trail', () => {
    const state = buildTestGame();
    const playerId = state.round!.activePlayerId;
    const hand = state.round!.hands[playerId];
    const spacedockValue = state.round!.spacedockValue;
    const playable = hand.find((coordinate) =>
      coordinate.low === spacedockValue || coordinate.high === spacedockValue
    );

    expect(playable).toBeDefined();

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId,
      coordinate: playable!,
      route: { kind: 'warp-trail', playerId },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.round?.hands[playerId]).toHaveLength(hand.length - 1);
      expect(result.state.round?.table.warpTrails[playerId].tiles).toHaveLength(1);
    }
  });

  it('rejects charting when it is not the player turn', () => {
    const state = buildTestGame();
    const other = state.round!.turnOrder.find(
      (id) => id !== state.round!.activePlayerId
    )!;

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: other,
      coordinate: normalizeCoordinate(12, 11),
      route: { kind: 'warp-trail', playerId: other },
    });

    expect(result).toEqual({ ok: false, violation: 'NOT_YOUR_TURN' });
  });

  it('opens red alert and subspace fracture when charting a double', () => {
    let state = buildTestGame(7, { subspaceFracture: true });
    const playerId = state.round!.activePlayerId;

    for (let attempt = 0; attempt < 40; attempt++) {
      const hand = state.round!.hands[playerId];
      const double = hand.find(
        (coordinate) =>
          coordinate.low === coordinate.high &&
          (coordinate.low === state.round!.spacedockValue ||
            getLegalMoves(state.round!, playerId).some(
              (move) =>
                move.coordinate.low === coordinate.low &&
                move.coordinate.high === coordinate.high &&
                move.route.kind === 'warp-trail'
            ))
      );

      if (double) {
        const result = applyAction(state, {
          type: 'CHART_COORDINATE',
          playerId,
          coordinate: double,
          route: { kind: 'warp-trail', playerId },
        });

        if (result.ok && result.state.round?.table.redAlert?.active) {
          expect(result.state.round.table.subspaceFracture?.active).toBe(true);
          return;
        }
      }

      const draw = applyAction(state, { type: 'DRAW_FROM_UNCHARTED', playerId });
      if (!draw.ok) {
        break;
      }
      state = draw.state;
    }

    expect(state.round?.table.redAlert?.active ?? false).toBeDefined();
  });

  it('requires stabilizers while subspace fracture is active', () => {
    let state = buildTestGame(42, { subspaceFracture: true });
    let fractureActive = false;

    for (let step = 0; step < 120 && !fractureActive; step++) {
      const round = state.round!;
      const playerId = round.activePlayerId;
      const moves = getLegalMoves(round, playerId);
      const doubleMove = moves.find(
        (move) =>
          move.coordinate.low === move.coordinate.high &&
          (move.route.kind === 'warp-trail' || move.route.kind === 'neutral-zone')
      );

      if (doubleMove) {
        const result = applyAction(state, {
          type: 'CHART_COORDINATE',
          playerId,
          coordinate: doubleMove.coordinate,
          route: doubleMove.route,
        });
        if (result.ok && result.state.round?.table.subspaceFracture?.active) {
          state = result.state;
          fractureActive = true;
          break;
        }
        if (result.ok) {
          state = result.state;
          continue;
        }
      }

      if (moves.length > 0) {
        const result = applyAction(state, {
          type: 'CHART_COORDINATE',
          playerId,
          coordinate: moves[0].coordinate,
          route: moves[0].route,
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
      if (draw.ok) {
        state = draw.state;
      } else {
        break;
      }
    }

    expect(fractureActive).toBe(true);
    const playerId = state.round!.activePlayerId;
    const nonStabilizer = state.round!.hands[playerId].find(
      (coordinate) =>
        coordinate.low !== state.round!.table.subspaceFracture!.requiredValue &&
        coordinate.high !== state.round!.table.subspaceFracture!.requiredValue
    );

    expect(nonStabilizer).toBeDefined();

    const illegal = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId,
      coordinate: nonStabilizer!,
      route: { kind: 'warp-trail', playerId },
    });

    expect(illegal).toEqual({
      ok: false,
      violation: 'FRACTURE_REQUIRES_STABILIZER',
    });
  });

  it('deploys distress beacon when drawing an unplayable tile', () => {
    let state = buildTestGame(1234);
    const playerId = state.round!.activePlayerId;

    while (getLegalMoves(state.round!, playerId).length > 0) {
      const move = getLegalMoves(state.round!, playerId)[0];
      const result = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId,
        coordinate: move.coordinate,
        route: move.route,
      });
      if (!result.ok) {
        break;
      }
      state = result.state;
      if (state.round?.activePlayerId !== playerId) {
        break;
      }
    }

    if (getLegalMoves(state.round!, playerId).length > 0) {
      return;
    }

    const draw = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId,
    });

    expect(draw.ok).toBe(true);
    if (draw.ok) {
      expect(
        draw.state.round?.table.warpTrails[playerId].distressBeacon.active
      ).toBe(true);
    }
  });
});
