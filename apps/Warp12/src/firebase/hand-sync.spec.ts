import { describe, expect, it } from 'vitest';

import { patchHandCounts } from './hand-counts.js';

/**
 * Regression: each move only knows the actor's private hand. Serializing that
 * partial engine state must not zero opponents' public counts or hand subdocs.
 */
describe('online hand sync', () => {
  it('patchHandCounts only updates the acting captain', () => {
    const previous = { picard: 15, kirk: 15, janeway: 15 };
    expect(
      patchHandCounts(previous, ['picard', 'kirk', 'janeway'], 'picard', 14)
    ).toEqual({ picard: 14, kirk: 15, janeway: 15 });
  });

  it('does not invent zero counts for untouched captains on the first move', () => {
    expect(
      patchHandCounts({}, ['picard', 'kirk', 'janeway'], 'picard', 14)
    ).toEqual({ picard: 14 });
  });
});
