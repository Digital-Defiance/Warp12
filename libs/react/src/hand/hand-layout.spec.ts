import { describe, expect, it } from 'vitest';

import type { Coordinate } from 'warp12-engine';

import { bestTrainLayout, coordinateKey } from './hand-layout';

const tile = (low: number, high: number): Coordinate => ({ low, high });

describe('bestTrainLayout', () => {
  it('chains from the trail open end, not an obsolete spacedock value', () => {
    const hand = [tile(4, 9), tile(9, 12), tile(0, 4), tile(3, 7)];

    const fromSpacedock = bestTrainLayout(hand, 0);
    expect(fromSpacedock.order[0]).toBe(coordinateKey(tile(0, 4)));

    const fromOpenFour = bestTrainLayout(hand, 4);
    expect(fromOpenFour.order.slice(0, 2)).toEqual([
      coordinateKey(tile(4, 9)),
      coordinateKey(tile(9, 12)),
    ]);
    expect(fromOpenFour.order).toContain(coordinateKey(tile(0, 4)));
    expect(fromOpenFour.order).toContain(coordinateKey(tile(3, 7)));
  });

  it('orients the first chain tile toward the connect value', () => {
    const hand = [tile(4, 9), tile(9, 12)];
    const layout = bestTrainLayout(hand, 4);

    expect(layout.flipped?.[coordinateKey(tile(4, 9))]).toBeFalsy();
    expect(layout.flipped?.[coordinateKey(tile(9, 12))]).toBeFalsy();
  });
});
