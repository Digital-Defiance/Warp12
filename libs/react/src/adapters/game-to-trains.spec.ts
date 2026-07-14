import { describe, expect, it } from 'vitest';

import type { PlacedCoordinate, RoundState } from 'warp12-engine';
import { formSquadrons, trailsOpenToOthers } from 'warp12-engine';

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

  describe('Module Zeta — squad trails', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);

    it('does not crash for a squad member who is not the trail key owner', () => {
      // Only 'a' (squad-1's trailKey) has a real warpTrails entry — 'c' is a
      // squadmate sharing it. Before the fix this indexed warpTrails['c']
      // directly (undefined) and crashed on trail.tiles.
      const round = {
        spacedockValue: 6,
        turnOrder: ['a', 'b', 'c', 'd'],
        squadrons,
        table: {
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(6, 3, 0, 3)],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
        },
      } as unknown as RoundState;

      expect(() => gameStateToTrains(round, 8)).not.toThrow();
    });

    it('renders the same shared-trail tiles for every member of the squad', () => {
      const round = {
        spacedockValue: 6,
        turnOrder: ['a', 'b', 'c', 'd'],
        squadrons,
        table: {
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(6, 3, 0, 3)],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
        },
      } as unknown as RoundState;

      const trains = gameStateToTrains(round, 8);
      // 'a' and 'c' are squad-1 (share trailKey 'a'); 'b' and 'd' are squad-2
      // (share trailKey 'b'). Squadmates render the SAME train slot/content
      // as their trail's canonical owner — there's no separate empty train
      // for a non-owner squadmate to render at all (their seat is skipped;
      // gameStateToTrains loops turnOrder, and every member maps to the
      // owner's trail content via trailKeyFor, so both slots show the tile).
      const squad1Train = trains.find((t) => t.playerId === 0); // 'a' slot
      expect(squad1Train?.dominoes[0]).toEqual({ value1: 6, value2: 3 });
    });

    it('trailsOpenToOthers resolves correctly when passed a squadmate id directly', () => {
      const round = {
        spacedockValue: 6,
        turnOrder: ['a', 'b', 'c', 'd'],
        squadrons,
        table: {
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: true },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
        },
      } as unknown as RoundState;

      // 'c' shares a's trail (beacon active) — passing 'c' directly (as the
      // react adapter's isPublic: trailsOpenToOthers(round, captainId) does)
      // must resolve through trailKeyFor, not crash / return false.
      expect(trailsOpenToOthers(round, 'c')).toBe(true);
      expect(trailsOpenToOthers(round, 'd')).toBe(false);
    });
  });
});
