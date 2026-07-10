/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

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
    document.elementFromPoint =
      document.elementFromPoint ??
      (() => null);
  });

  it('restores each player hand order when switching seats in pass-and-play', () => {
    const gameId = 'local-pass-and-play';
    const armstrongHand = [tile(0, 1), tile(2, 3), tile(4, 5)];
    const lovellHand = [tile(6, 7), tile(8, 9)];

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
        initialProps: { playerId: 'human:0', hand: armstrongHand },
      }
    );

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(4, 5)),
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(2, 3)),
    ]);

    rerender({ playerId: 'human:1', hand: lovellHand });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(8, 9)),
      coordinateKey(tile(6, 7)),
    ]);

    rerender({ playerId: 'human:0', hand: armstrongHand });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(4, 5)),
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(2, 3)),
    ]);
  });

  it('persists custom order edits across seat switches', () => {
    const gameId = 'local-pass-and-play';
    const armstrongHand = [tile(0, 1), tile(2, 3)];
    const lovellHand = [tile(6, 7), tile(8, 9)];

    const { result, rerender } = renderHook(
      ({ playerId, hand }: { playerId: string; hand: readonly Coordinate[] }) =>
        useHandLayout(gameId, playerId, hand),
      {
        initialProps: { playerId: 'human:0', hand: armstrongHand },
      }
    );

    act(() => {
      result.current.applySort('pips-desc');
    });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(2, 3)),
      coordinateKey(tile(0, 1)),
    ]);

    rerender({ playerId: 'human:1', hand: lovellHand });
    rerender({ playerId: 'human:0', hand: armstrongHand });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(2, 3)),
      coordinateKey(tile(0, 1)),
    ]);

    const stored = localStorage.getItem(handLayoutStorageKey(gameId, 'human:0'));
    expect(stored).toContain(coordinateKey(tile(2, 3)));
  });

  it('reorders tiles with pointer drag for touch devices', () => {
    const gameId = 'touch-hand';
    const hand = [tile(0, 1), tile(2, 3), tile(4, 5)];

    const { result } = renderHook(() => useHandLayout(gameId, 'human:0', hand));

    act(() => {
      result.current.onHandTilePointerDown('0-1', {
        button: 0,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 10,
        clientY: 10,
        nativeEvent: { pointerType: 'touch' },
        currentTarget: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
          hasPointerCapture: vi.fn(() => true),
        },
      } as never);
    });

    act(() => {
      result.current.onHandTilePointerMove({
        pointerId: 1,
        pointerType: 'touch',
        clientX: 30,
        clientY: 30,
        nativeEvent: { pointerType: 'touch' },
      } as never);
    });

    const targetButton = document.createElement('button');
    targetButton.setAttribute('data-hand-tile-key', '4-5');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetButton);

    act(() => {
      result.current.onHandTilePointerUp('0-1', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 30,
        clientY: 30,
        nativeEvent: { pointerType: 'touch' },
        currentTarget: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
          hasPointerCapture: vi.fn(() => true),
        },
      } as never);
    });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(2, 3)),
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(4, 5)),
    ]);
  });

  it('reorders with pointer drag for mouse too (WKWebview has no native HTML5 DnD)', () => {
    const gameId = 'mouse-hand';
    const hand = [tile(0, 1), tile(2, 3), tile(4, 5)];

    const { result } = renderHook(() => useHandLayout(gameId, 'human:0', hand));

    act(() => {
      result.current.onHandTilePointerDown('0-1', {
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
        nativeEvent: { pointerType: 'mouse' },
        currentTarget: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
          hasPointerCapture: vi.fn(() => true),
        },
      } as never);
    });

    act(() => {
      result.current.onHandTilePointerMove({
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 30,
        clientY: 30,
        nativeEvent: { pointerType: 'mouse' },
      } as never);
    });

    const targetButton = document.createElement('button');
    targetButton.setAttribute('data-hand-tile-key', '4-5');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetButton);

    act(() => {
      result.current.onHandTilePointerUp('0-1', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 30,
        clientY: 30,
        nativeEvent: { pointerType: 'mouse' },
        currentTarget: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
          hasPointerCapture: vi.fn(() => true),
        },
      } as never);
    });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(2, 3)),
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(4, 5)),
    ]);
  });

  it('defers reorder when horizontal scroll mode and swipe is mostly horizontal', () => {
    const gameId = 'scroll-hand';
    const hand = [tile(0, 1), tile(2, 3), tile(4, 5)];

    const { result } = renderHook(() =>
      useHandLayout(gameId, 'human:0', hand, { horizontalScroll: true })
    );

    const captureTarget = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => false),
    };

    act(() => {
      result.current.onHandTilePointerDown('0-1', {
        button: 0,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 10,
        clientY: 10,
        nativeEvent: { pointerType: 'touch' },
        currentTarget: captureTarget,
      } as never);
    });

    expect(captureTarget.setPointerCapture).not.toHaveBeenCalled();

    act(() => {
      result.current.onHandTilePointerMove({
        pointerId: 1,
        pointerType: 'touch',
        clientX: 50,
        clientY: 12,
        nativeEvent: { pointerType: 'touch' },
      } as never);
    });

    act(() => {
      result.current.onHandTilePointerUp('0-1', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 50,
        clientY: 12,
        nativeEvent: { pointerType: 'touch' },
        currentTarget: captureTarget,
      } as never);
    });

    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(2, 3)),
      coordinateKey(tile(4, 5)),
    ]);
    expect(result.current.shouldIgnoreClick()).toBe(false);
  });

  it('treats a mouse click (no movement) as a non-drag so click-to-flip works', () => {
    const gameId = 'mouse-click';
    const hand = [tile(0, 1), tile(2, 3)];

    const { result } = renderHook(() => useHandLayout(gameId, 'human:0', hand));

    act(() => {
      result.current.onHandTilePointerDown('0-1', {
        button: 0,
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
        nativeEvent: { pointerType: 'mouse' },
        currentTarget: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
          hasPointerCapture: vi.fn(() => true),
        },
      } as never);
    });

    act(() => {
      result.current.onHandTilePointerUp('0-1', {
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 11,
        clientY: 11,
        nativeEvent: { pointerType: 'mouse' },
        currentTarget: {
          setPointerCapture: vi.fn(),
          releasePointerCapture: vi.fn(),
          hasPointerCapture: vi.fn(() => true),
        },
      } as never);
    });

    // No drag past the threshold → order unchanged and click is not ignored.
    expect(result.current.orderedHand.map(coordinateKey)).toEqual([
      coordinateKey(tile(0, 1)),
      coordinateKey(tile(2, 3)),
    ]);
    expect(result.current.shouldIgnoreClick()).toBe(false);
  });
});
