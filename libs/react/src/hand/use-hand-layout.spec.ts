/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';

import type { Coordinate } from 'warp12-engine';

import {
  coordinateKey,
  handLayoutStorageKey,
  writeStoredHandLayout,
} from './hand-layout.js';
import { useHandLayout } from './use-hand-layout.js';

const tile = (low: number, high: number): Coordinate => ({ low, high });

describe('useHandLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores each player hand order when switching seats in pass-and-play', () => {
    const gameId = 'local-pass-and-play';
    const picardHand = [tile(0, 1), tile(2, 3), tile(4, 5)];
    const rikerHand = [tile(6, 7), tile(8, 9)];

    writeStoredHandLayout(gameId, 'human:0', {
      order: [coordinateKey(tile(4, 5)), coordinateKey(tile(0, 1)), coordinateKey(tile(2, 3))],
    });
    writeStoredHandLayout(gameId, 'human:1', {
      order: [coordinateKey(tile(8, 9)), coordinateKey(tile(6, 7))],
    });

    const { result, rerender } = renderHook(
      ({ playerId, hand }: { playerId: string; hand: readonly Coordinate[] }) =>
        useHandLayout(gameId, playerId, hand),
      {
        initialProps: { playerId: 'human:0', hand: picardHand },
      }
    );

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(4, 5)),
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(2, 3)),
    ]);

    rerender({ playerId: 'human:1', hand: rikerHand });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(8, 9)),
      coordinateKey(tile(6, 7)),
    ]);

    rerender({ playerId: 'human:0', hand: picardHand });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(4, 5)),
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(2, 3)),
    ]);
  });

  it('persists custom order edits across seat switches', () => {
    const gameId = 'local-pass-and-play';
    const picardHand = [tile(0, 1), tile(2, 3)];
    const rikerHand = [tile(6, 7), tile(8, 9)];

    const { result, rerender } = renderHook(
      ({ playerId, hand }: { playerId: string; hand: readonly Coordinate[] }) =>
        useHandLayout(gameId, playerId, hand),
      {
        initialProps: { playerId: 'human:0', hand: picardHand },
      }
    );

    act(() => {
      result.current.applySort('pips-desc');
    });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(2, 3)),
      coordinateKey(tile(0, 1)),
    ]);

    rerender({ playerId: 'human:1', hand: rikerHand });
    rerender({ playerId: 'human:0', hand: picardHand });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(2, 3)),
      coordinateKey(tile(0, 1)),
    ]);

    const stored = localStorage.getItem(handLayoutStorageKey(gameId, 'human:0'));
    expect(stored).toContain(coordinateKey(tile(2, 3)));
  });
});
