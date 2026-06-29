import { describe, expect, it } from 'vitest';

import type { PlacedCoordinate, RoundState } from 'warp12-engine';

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

  it('renders chicken feet on a neutral zone fracture', () => {
    const anchor = placed(5, 5, 1, 5);
    const round = {
      spacedockValue: 12,
      turnOrder: ['captain-a'],
      table: {
        warpTrails: {
          'captain-a': {
            playerId: 'captain-a',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [placed(5, 12, 0, 5), anchor] },
        subspaceFracture: {
          active: true,
          anchor,
          stabilizers: [placed(1, 5, 0, 5), placed(2, 5, 1, 5)],
          requiredValue: 5,
          neutralZone: true,
        },
      },
    } as unknown as RoundState;

    const trains = gameStateToTrains(round, 8);
    const neutral = trains.find((train) => train.playerId === NEUTRAL_ZONE_SLOT);
    expect(neutral?.feet?.[1]).toHaveLength(2);
  });

  it('renders archived fracture stabilizers as chicken feet after resolve', () => {
    const round = {
      spacedockValue: 11,
      turnOrder: ['captain-a'],
      table: {
        warpTrails: {
          'captain-a': {
            playerId: 'captain-a',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: {
          tiles: [
            placed(9, 11, 0, 9),
            placed(9, 9, 1, 9),
            placed(4, 9, 2, 4),
            placed(0, 9, 3, 0),
            placed(2, 9, 4, 2),
            placed(2, 5, 5, 5),
          ],
        },
        subspaceFracture: null,
      },
    } as unknown as RoundState;

    const trains = gameStateToTrains(round, 8);
    const neutral = trains.find((train) => train.playerId === NEUTRAL_ZONE_SLOT);
    expect(neutral?.dominoes).toEqual([
      { value1: 11, value2: 9 },
      { value1: 9, value2: 9 },
      { value1: 9, value2: 2 },
      { value1: 2, value2: 5 },
    ]);
    expect(neutral?.feet?.[1]).toHaveLength(2);
    expect(neutral?.feet?.[1]?.[0]?.dominoes[0]).toEqual({
      value1: 9,
      value2: 4,
    });
  });

  it('keeps the third stabilizer inline and avoids stacked doubles after resolve', () => {
    const round = {
      spacedockValue: 12,
      turnOrder: ['captain-a'],
      table: {
        warpTrails: {
          'captain-a': {
            playerId: 'captain-a',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: {
          tiles: [
            placed(3, 12, 0, 3),
            placed(3, 3, 1, 3),
            placed(0, 3, 2, 0),
            placed(3, 5, 3, 5),
            placed(1, 3, 4, 1),
            placed(1, 1, 5, 1),
          ],
        },
        subspaceFracture: null,
      },
    } as unknown as RoundState;

    const trains = gameStateToTrains(round, 8);
    const neutral = trains.find((train) => train.playerId === NEUTRAL_ZONE_SLOT);
    expect(neutral?.dominoes).toEqual([
      { value1: 12, value2: 3 },
      { value1: 3, value2: 3 },
      { value1: 3, value2: 1 },
      { value1: 1, value2: 1 },
    ]);
    expect(neutral?.feet?.[1]).toEqual([
      { dominoes: [{ value1: 3, value2: 0 }] },
      { dominoes: [{ value1: 3, value2: 5 }] },
    ]);
  });

  it('renders a red alert cover inline when subspace fracture is off', () => {
    const round = {
      spacedockValue: 12,
      turnOrder: ['captain-a'],
      table: {
        warpTrails: {
          'captain-a': {
            playerId: 'captain-a',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: {
          tiles: [
            placed(1, 12, 0, 1),
            placed(1, 7, 1, 7),
            placed(4, 7, 2, 4),
            placed(4, 9, 3, 9),
            placed(9, 9, 4, 9),
            placed(3, 9, 5, 3),
          ],
        },
        subspaceFracture: null,
      },
    } as unknown as RoundState;

    const trains = gameStateToTrains(round, 8);
    const neutral = trains.find((train) => train.playerId === NEUTRAL_ZONE_SLOT);
    expect(neutral?.dominoes).toEqual([
      { value1: 12, value2: 1 },
      { value1: 1, value2: 7 },
      { value1: 7, value2: 4 },
      { value1: 4, value2: 9 },
      { value1: 9, value2: 9 },
      { value1: 9, value2: 3 },
    ]);
    expect(neutral?.feet).toBeUndefined();
  });
});
