import { describe, expect, it } from 'vitest';

import {
  buildCaptainTailRows,
  buildTailRows,
  formatTailCoordinate,
  tailTileDisplayValues,
} from './captain-tails-hud.js';

describe('captain-tails-hud', () => {
  const round = {
    spacedockValue: 12,
    turnOrder: ['a', 'b'],
    activePlayerId: 'b',
    table: {
      warpTrails: {
        a: {
          playerId: 'a',
          tiles: [
            {
              coordinate: { low: 6, high: 12 },
              index: 0,
              openValue: 6,
            },
          ],
          distressBeacon: { active: false },
        },
        b: {
          playerId: 'b',
          tiles: [],
          distressBeacon: { active: true },
        },
      },
      neutralZone: {
        tiles: [
          {
            coordinate: { low: 3, high: 9 },
            index: 0,
            openValue: 3,
          },
        ],
      },
    },
  } as never;

  const spokes = [
    {
      slot: 0,
      captainId: 'a',
      label: 'Alpha',
      state: 'shields',
      connectValue: 6,
    },
    {
      slot: 1,
      captainId: 'b',
      label: 'Beta',
      state: 'open',
      connectValue: 12,
    },
    {
      slot: 4,
      captainId: null,
      label: 'Neutral',
      state: 'neutral',
      connectValue: 3,
    },
  ] as never;

  it('includes AI officer commission abbrev when provided', () => {
    const rows = buildTailRows(
      round,
      spokes,
      'b',
      { a: 'Ens.', b: 'Cmdr.' },
      { a: 'Ensign', b: 'Commander' }
    );
    expect(rows[0]?.tacticalClassAbbrev).toBe('Ens.');
    expect(rows[0]?.tacticalClassLabel).toBe('Ensign');
    expect(rows[1]?.tacticalClassAbbrev).toBe('Cmdr.');
  });

  it('lists captains in turn order with trail tails', () => {
    expect(buildCaptainTailRows(round, spokes, 'b')).toEqual([
      {
        rowId: 'a',
        label: 'Alpha',
        connectValue: 6,
        lastTile: {
          coordinate: { low: 6, high: 12 },
          index: 0,
          openValue: 6,
        },
        state: 'shields',
        isActive: false,
        hasHazardMarker: false,
        trailLength: 1,
      },
      {
        rowId: 'b',
        label: 'Beta',
        connectValue: 12,
        lastTile: null,
        state: 'open',
        isActive: true,
        hasHazardMarker: false,
        trailLength: 0,
      },
    ]);
  });

  it('includes neutral zone after captains', () => {
    expect(buildTailRows(round, spokes, 'b')).toEqual([
      {
        rowId: 'a',
        label: 'Alpha',
        connectValue: 6,
        lastTile: {
          coordinate: { low: 6, high: 12 },
          index: 0,
          openValue: 6,
        },
        state: 'shields',
        isActive: false,
        hasHazardMarker: false,
        trailLength: 1,
      },
      {
        rowId: 'b',
        label: 'Beta',
        connectValue: 12,
        lastTile: null,
        state: 'open',
        isActive: true,
        hasHazardMarker: false,
        trailLength: 0,
      },
      {
        rowId: 'neutral-zone',
        label: 'Neutral zone',
        connectValue: 3,
        lastTile: {
          coordinate: { low: 3, high: 9 },
          index: 0,
          openValue: 3,
        },
        state: 'neutral',
        isActive: false,
        hasHazardMarker: false,
        trailLength: 1,
      },
    ]);
  });

  it('orients tail domino with anchor on the left and open tail on the right', () => {
    expect(
      tailTileDisplayValues({
        coordinate: { low: 3, high: 8 },
        index: 2,
        openValue: 3,
      })
    ).toEqual({ left: 8, right: 3 });
  });

  it('formats tail coordinates with anchor on the left and open tail on the right', () => {
    expect(
      formatTailCoordinate(
        {
          coordinate: { low: 1, high: 2 },
          index: 0,
          openValue: 2,
        },
        12
      )
    ).toBe('1:2');
    expect(
      formatTailCoordinate(
        {
          coordinate: { low: 6, high: 12 },
          index: 0,
          openValue: 6,
        },
        12
      )
    ).toBe('12:6');
    expect(
      formatTailCoordinate(
        {
          coordinate: { low: 6, high: 6 },
          index: 1,
          openValue: 6,
        },
        12
      )
    ).toBe('6:6');
    expect(formatTailCoordinate(null, 12)).toBe('12:12');
  });
});
