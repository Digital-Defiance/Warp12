import { describe, expect, it } from 'vitest';

import { handTileCount, observationToState, warpLeafEvalGoOut } from './search-model.js';
import { makeRound } from './test-fixtures.js';
import { obsFor } from './test-fixtures.js';

describe('warpLeafEvalGoOut race short-circuit', () => {
  it('crashes the eval when an opponent is on one tile and we are not', () => {
    const round = makeRound({
      hands: {
        a: [
          { low: 12, high: 11 },
          { low: 11, high: 9 },
          { low: 9, high: 5 },
        ],
        b: [{ low: 2, high: 0 }],
      },
    });
    const state = observationToState(obsFor(round, undefined, 'go-out', 'a'));
    expect(warpLeafEvalGoOut(state, 'a')).toBeLessThan(-40_000);
    expect(handTileCount(round.hands.b ?? [])).toBe(1);
  });
});
