import { describe, expect, it } from 'vitest';

import type { PlacedCoordinate, RoundState } from '@warp12/Warp12-lib';

import {
  NEUTRAL_ZONE_SLOT,
  gameStateToTrains,
  placedToDomino,
  tilesToDominoChain,
} from './game-to-trains';

function placed(
  low: number,
  high: number,
  index: number,
  openValue: number
): PlacedCoordinate {
  return { coordinate: { low, high }, index, openValue };
}

describe('placedToDomino', () => {
  it('orients the first tile toward the hub when connectValue is spacedock 0', () => {
    expect(placedToDomino(placed(0, 4, 0, 4), 0)).toEqual({
      value1: 0,
      value2: 4,
    });
  });

  it('ignores a reversed openValue when connectValue is provided', () => {
    expect(placedToDomino(placed(0, 4, 0, 0), 0)).toEqual({
      value1: 0,
      value2: 4,
    });
  });

  it('chains off the previous open end', () => {
    expect(placedToDomino(placed(4, 9, 1, 9), 4)).toEqual({
      value1: 4,
      value2: 9,
    });
  });
});

describe('tilesToDominoChain', () => {
  it('keeps like-values touching along a trail', () => {
    const chain = tilesToDominoChain(
      [placed(0, 4, 0, 4), placed(4, 9, 1, 9), placed(9, 9, 2, 9)],
      0
    );

    expect(chain).toEqual([
      { value1: 0, value2: 4 },
      { value1: 4, value2: 9 },
      { value1: 9, value2: 9 },
    ]);
  });
});

describe('gameStateToTrains', () => {
  it('maps the first warp-trail tile with blank toward spacedock 0', () => {
    const round = {
      spacedockValue: 0,
      turnOrder: ['captain-a'],
      table: {
        warpTrails: {
          'captain-a': {
            playerId: 'captain-a',
            tiles: [placed(0, 4, 0, 4)],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [] },
        subspaceFracture: null,
      },
    } as unknown as RoundState;

    const trains = gameStateToTrains(round);
    expect(trains[0]?.dominoes[0]).toEqual({ value1: 0, value2: 4 });
  });

  it('assigns the neutral zone to slot 7', () => {
    const round = {
      spacedockValue: 0,
      turnOrder: ['captain-a'],
      table: {
        warpTrails: {
          'captain-a': {
            playerId: 'captain-a',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [placed(0, 8, 0, 8)] },
        subspaceFracture: null,
      },
    } as unknown as RoundState;

    const trains = gameStateToTrains(round, 8);
    const neutral = trains.find((train) => train.playerId === NEUTRAL_ZONE_SLOT);
    expect(neutral?.dominoes[0]).toEqual({ value1: 0, value2: 8 });
  });
});
