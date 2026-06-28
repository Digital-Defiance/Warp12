import { describe, expect, it } from 'vitest';

import type { RoundState } from '@warp12/Warp12-lib';

import {
  detectNewChart,
  panToCenterContentPoint,
  type ChartSite,
} from './table-focus.js';

function baseRound(overrides: Partial<RoundState> = {}): RoundState {
  return {
    roundNumber: 1,
    spacedockValue: 12,
    phase: 'playing',
    activePlayerId: 'a',
    turnOrder: ['a', 'b'],
    hands: { a: [], b: [] },
    unchartedSectors: [],
    treatyDeclarationRequired: false,
    treatyDeclared: false,
    roundWinnerId: null,
    qPendingInvoker: null,
    qEffects: null,
    qGamblePending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    table: {
      spacedock: { value: 12, placedBy: 'a' },
      warpTrails: {
        a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
        b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
      },
      neutralZone: { tiles: [] },
      subspaceFracture: null,
      redAlert: null,
    },
    ...overrides,
  };
}

describe('detectNewChart', () => {
  it('returns null without a previous snapshot', () => {
    expect(detectNewChart(null, baseRound())).toBeNull();
  });

  it('detects a new warp-trail tile', () => {
    const previous = baseRound();
    const next = baseRound({
      table: {
        ...previous.table,
        warpTrails: {
          ...previous.table.warpTrails,
          b: {
            playerId: 'b',
            tiles: [
              {
                coordinate: { low: 6, high: 7 },
                index: 0,
                openValue: 7,
              },
            ],
            distressBeacon: { active: false },
          },
        },
      },
    });

    expect(detectNewChart(previous, next)).toEqual({
      kind: 'warp-trail',
      captainId: 'b',
      tileIndex: 0,
    } satisfies ChartSite);
  });

  it('detects a new neutral-zone tile', () => {
    const previous = baseRound();
    const next = baseRound({
      table: {
        ...previous.table,
        neutralZone: {
          tiles: [
            {
              coordinate: { low: 5, high: 5 },
              index: 0,
              openValue: 5,
            },
          ],
        },
      },
    });

    expect(detectNewChart(previous, next)).toEqual({
      kind: 'neutral-zone',
      tileIndex: 0,
    });
  });
});

describe('panToCenterContentPoint', () => {
  it('centers a content coordinate in the viewport', () => {
    expect(panToCenterContentPoint(800, 600, 1, 400, 300)).toEqual({
      x: 0,
      y: 0,
    });
    expect(panToCenterContentPoint(800, 600, 2, 100, 50)).toEqual({
      x: 200,
      y: 200,
    });
  });
});
