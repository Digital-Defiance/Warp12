import { describe, it, expect } from 'vitest';
import { startGame } from '../setup/create-game.ts';
import { applyAction } from './apply-action.js';
import { scoreRound } from './scoring.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import {
  resolveModules,
  type GameModuleConfig,
} from '../types/modules.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/** Hot Potato only — every other module left off. */
const DELTA_ONLY: GameModuleConfig = {
  warpDriveSpool: true,
  continuum: false,
  salamanderPenalty: false,
  sensorGrid: false,
  drafting: false,
  squadrons: false,
  longestTrail: false,
  doubleDown: false,
  temporalDebt: false,
  temporalInversion: false,
  wormholes: false,
  subspaceFracture: false,
};

/**
 * Hot Potato off while other modules are on — hazard marker must stay dormant.
 * Drafting / squadrons omitted: drafting postpones the first round, squadrons
 * need ≥4 captains. Fracture stays off in chart/pass fixtures for legality.
 */
const EVERYTHING_ELSE_DELTA_OFF: GameModuleConfig = {
  warpDriveSpool: false,
  continuum: true,
  salamanderPenalty: true,
  sensorGrid: true,
  drafting: false,
  squadrons: false,
  longestTrail: true,
  doubleDown: true,
  temporalDebt: true,
  temporalInversion: true,
  wormholes: true,
  subspaceFracture: false,
};

function roundWithNzOpenAt(
  spacedockValue: number,
  handTile: ReturnType<typeof T>
) {
  const base = makeRound(['a', 'b'], { spacedockValue, activePlayerId: 'a' });
  return makeRound(['a', 'b'], {
    spacedockValue,
    activePlayerId: 'a',
    hands: {
      a: [handTile],
      b: [],
    },
    table: {
      ...base.table,
      warpTrails: {
        a: {
          tiles: [placed(T(spacedockValue, 8), 0, 8)],
          distressBeacon: { active: false },
        },
        b: {
          tiles: [],
          distressBeacon: { active: false },
        },
      },
      neutralZone: { tiles: [] },
    },
  });
}

function roundReadyToPass(holder: 'a' | 'b' = 'a') {
  const baseTable = makeRound(['a', 'b'], { spacedockValue: 12 }).table;
  return makeRound(['a', 'b'], {
    spacedockValue: 12,
    activePlayerId: holder,
    hands: { a: [], b: [] },
    unchartedSectors: [],
    hazardMarkerHolder: holder,
    hazardMarkerPassCount: 0,
    drewThisTurn: true,
    table: {
      ...baseTable,
      warpTrails: {
        ...baseTable.warpTrails,
        [holder]: {
          ...baseTable.warpTrails[holder]!,
          tiles: [placed(T(12, 8), 0, 8)],
          distressBeacon: { active: true },
        },
      },
    },
  });
}

describe('Module Delta — Hot Potato hazard marker', () => {
  it('initializes hazard marker with round starter when enabled', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1000));

    const game = startGame(
      {
        id: 'hot-potato-init',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: DELTA_ONLY,
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    expect(game.modules.warpDriveSpool.enabled).toBe(true);
    expect(game.round!.hazardMarkerHolder).toBeDefined();
    expect(game.round!.hazardMarkerHolder).not.toBeNull();
    expect(game.round!.hazardMarkerPassCount).toBe(0);
  });

  it('does not initialize a hazard marker when Module Delta is off (other modules on)', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1001));

    const game = startGame(
      {
        id: 'hot-potato-init-off',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: {
          ...EVERYTHING_ELSE_DELTA_OFF,
          subspaceFracture: true,
        },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    expect(game.modules.warpDriveSpool.enabled).toBe(false);
    expect(game.modules.wormholes.enabled).toBe(true);
    expect(game.modules.subspaceFracture.enabled).toBe(true);
    expect(game.round!.hazardMarkerHolder).toBeUndefined();
    expect(game.round!.hazardMarkerPassCount).toBeUndefined();
  });

  it('transfers hazard marker to the captain who charts onto Neutral Zone', () => {
    const round = roundWithNzOpenAt(12, T(12, 5));
    const game = makeGame(round, {
      modules: resolveModules(DELTA_ONLY),
    });

    expect(game.round!.hazardMarkerHolder).toBeUndefined();

    const result = applyAction(game, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.round!.hazardMarkerHolder).toBe('a');
    expect(result.state.round!.hazardMarkerPassCount).toBe(0);
  });

  it('does not assign hazard marker on Neutral Zone charts when Module Delta is off (other modules on)', () => {
    const round = roundWithNzOpenAt(12, T(12, 5));
    const game = makeGame(round, {
      modules: resolveModules(EVERYTHING_ELSE_DELTA_OFF),
    });

    expect(game.modules.warpDriveSpool.enabled).toBe(false);
    expect(game.modules.wormholes.enabled).toBe(true);

    const result = applyAction(game, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.hazardMarkerHolder).toBeUndefined();
  });

  it('transfers hazard marker on Neutral Zone spool (does not clear it)', () => {
    // Holder is b; a spools onto NZ — a must take the marker (not null).
    const base = roundWithNzOpenAt(12, T(12, 5));
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hazardMarkerHolder: 'b',
      hazardMarkerPassCount: 2,
      hands: {
        a: [T(3, 4)],
        b: [],
      },
      // First draw matches NZ open (12), second mismatches to end spool.
      unchartedSectors: [T(12, 7), T(0, 1)],
      table: base.table,
    });
    const game = makeGame(round, {
      modules: resolveModules(DELTA_ONLY),
    });

    const result = applyAction(game, {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.table.neutralZone.tiles.length).toBeGreaterThan(0);
    expect(result.state.round!.hazardMarkerHolder).toBe('a');
    expect(result.state.round!.hazardMarkerPassCount).toBe(0);
  });

  it('keeps hazard marker on the spooling captain when they already hold it', () => {
    // Regression: NZ spool used to clear holder to null ("marker vanishes").
    const base = roundWithNzOpenAt(12, T(12, 5));
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hazardMarkerHolder: 'a',
      hazardMarkerPassCount: 1,
      hands: {
        a: [T(3, 4)],
        b: [],
      },
      unchartedSectors: [T(12, 7), T(0, 1)],
      table: base.table,
    });
    const game = makeGame(round, {
      modules: resolveModules(DELTA_ONLY),
    });

    const result = applyAction(game, {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.hazardMarkerHolder).toBe('a');
    expect(result.state.round!.hazardMarkerPassCount).toBe(0);
  });

  it('increments pass count when the hazard holder passes', () => {
    const game = makeGame(roundReadyToPass('a'), {
      modules: resolveModules(DELTA_ONLY),
    });

    const result = applyAction(game, {
      type: 'PASS_TURN',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.hazardMarkerHolder).toBe('a');
    expect(result.state.round!.hazardMarkerPassCount).toBe(1);
  });

  it('does not increment pass count when Module Delta is off (other modules on)', () => {
    const game = makeGame(roundReadyToPass('a'), {
      modules: resolveModules(EVERYTHING_ELSE_DELTA_OFF),
    });

    expect(game.modules.warpDriveSpool.enabled).toBe(false);

    const result = applyAction(game, {
      type: 'PASS_TURN',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.hazardMarkerPassCount).toBe(0);
  });

  it('applies +5 penalty for each pass while holding marker', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(4000));

    const game = startGame(
      {
        id: 'hot-potato-penalty',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: DELTA_ONLY,
        maxPip: 12,
        campaignRounds: 1,
      },
      { shuffledCoordinates: coords }
    );

    const gameWithPasses = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            hazardMarkerHolder: 'a',
            hazardMarkerPassCount: 2,
            phase: 'ended' as const,
            roundWinnerId: 'a',
          }
        : null,
    };

    const aliceBefore = gameWithPasses.captains.find((c) => c.id === 'a')!;

    const result = scoreRound(gameWithPasses, gameWithPasses.round!, seededRandom(4001));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const aliceAfter = result.state.captains.find((c) => c.id === 'a')!;

    // Alice won (0 hand penalty) but passed twice: +5 * 2 = +10
    expect(aliceAfter.pointsScore).toBe(aliceBefore.pointsScore + 10);
  });

  it('does not apply pass-penalty scoring if module disabled (other modules on)', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(5000));

    const game = startGame(
      {
        id: 'hot-potato-disabled',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: {
          ...EVERYTHING_ELSE_DELTA_OFF,
          subspaceFracture: true,
          // Keep scoring side-effects out so this asserts hazard only.
          longestTrail: false,
        },
        maxPip: 12,
        campaignRounds: 1,
      },
      { shuffledCoordinates: coords }
    );

    expect(game.modules.warpDriveSpool.enabled).toBe(false);
    expect(game.modules.wormholes.enabled).toBe(true);
    expect(game.modules.continuum.enabled).toBe(true);

    const gameWithPasses = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            hazardMarkerHolder: 'a',
            hazardMarkerPassCount: 2,
            phase: 'ended' as const,
            roundWinnerId: 'a',
          }
        : null,
    };

    const aliceBefore = gameWithPasses.captains.find((c) => c.id === 'a')!;

    const result = scoreRound(gameWithPasses, gameWithPasses.round!, seededRandom(5001));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const aliceAfter = result.state.captains.find((c) => c.id === 'a')!;

    // Winner with empty hand: 0 pip total — no Hot Potato +10.
    expect(aliceAfter.pointsScore).toBe(aliceBefore.pointsScore);
  });
});
