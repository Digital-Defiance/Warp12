import { describe, expect, it } from 'vitest';

import { patchHandCounts } from './hand-counts.js';

/**
 * Regression: each move only knows the actor's private hand. Serializing that
 * partial engine state must not zero opponents' public counts or hand subdocs.
 */
describe('online hand sync', () => {
  it('patchHandCounts only updates the acting captain', () => {
    const previous = { armstrong: 15, kirk: 15, janeway: 15 };
    expect(
      patchHandCounts(previous, ['armstrong', 'kirk', 'janeway'], 'armstrong', 14)
    ).toEqual({ armstrong: 14, kirk: 15, janeway: 15 });
  });

  it('does not invent zero counts for untouched captains on the first move', () => {
    expect(
      patchHandCounts({}, ['armstrong', 'kirk', 'janeway'], 'armstrong', 14)
    ).toEqual({ armstrong: 14 });
  });
});
