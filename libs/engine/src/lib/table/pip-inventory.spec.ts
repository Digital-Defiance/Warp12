import { describe, expect, it } from 'vitest';

import {
  countChartedTilesWithPip,
  isPipExhausted,
  isRedAlertDoubleDead,
  maxTilesWithPipInSet,
} from './pip-inventory.js';
import { allTilesWithPip, makeRound, placed, T } from '../engine/test-helpers.js';
import { createInitialTable } from './table-state.js';

describe('maxTilesWithPipInSet', () => {
  it('counts thirteen tiles for every pip in a double-twelve set', () => {
    expect(maxTilesWithPipInSet(0)).toBe(13);
    expect(maxTilesWithPipInSet(6)).toBe(13);
    expect(maxTilesWithPipInSet(12)).toBe(13);
  });
});

describe('countChartedTilesWithPip', () => {
  it('includes Spacedock, warp trails, neutral zone, and fracture stabilizers', () => {
    const round = makeRound(['a', 'b'], {
      spacedockValue: 6,
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        neutralZone: {
          tiles: [placed(T(6, 8), 0, 8)],
        },
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(3, 6), 0, 3)],
            distressBeacon: { active: false },
          },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        subspaceFracture: {
          active: true,
          anchor: placed(T(6, 6), 0, 6),
          stabilizers: [placed(T(6, 4), 0, 4)],
          requiredValue: 6,
        },
        redAlert: null,
      },
    });

    expect(countChartedTilesWithPip(round, 6)).toBe(4);
    expect(isPipExhausted(round, 6)).toBe(false);
  });
});

describe('isPipExhausted / isRedAlertDoubleDead', () => {
  it('is false when only some tiles with that pip are charted', () => {
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 12), 0, 6)],
            distressBeacon: { active: false },
          },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        redAlert: {
          active: true,
          anchor: placed(T(6, 6), 0, 6),
          responsiblePlayerId: 'a',
          trailPlayerId: 'a',
        },
      },
    });

    expect(isPipExhausted(round, 6)).toBe(false);
    expect(isRedAlertDoubleDead(round)).toBe(false);
  });

  it('is true when all thirteen sixes are on the table', () => {
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

    expect(countChartedTilesWithPip(round, 6)).toBe(13);
    expect(isPipExhausted(round, 6)).toBe(true);
    expect(isRedAlertDoubleDead(round)).toBe(true);
  });

  it('is false for pip 12 while twelves remain off the table', () => {
    const twelves = allTilesWithPip(12);
    const onTable = twelves.filter(
      (coordinate) =>
        !(coordinate.low === 12 && coordinate.high === 12) &&
        !(coordinate.low === 0 && coordinate.high === 12) &&
        !(coordinate.low === 4 && coordinate.high === 12)
    );
    const round = makeRound(['a', 'b'], {
      spacedockValue: 11,
      hands: {
        a: [T(12, 12), T(0, 12)],
        b: [T(4, 12)],
      },
      table: {
        ...createInitialTable(['a', 'b'], 11, 'a'),
        neutralZone: {
          tiles: onTable.map((coordinate, index) =>
            placed(coordinate, index, 12)
          ),
        },
      },
    });

    expect(countChartedTilesWithPip(round, 12)).toBeLessThan(13);
    expect(isPipExhausted(round, 12)).toBe(false);
  });
});
