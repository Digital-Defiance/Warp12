import { describe, expect, it } from 'vitest';

import { patchHandCounts } from './hand-counts.js';

describe('patchHandCounts', () => {
  it('updates only the acting captain and preserves the rest', () => {
    const previous = { a: 15, b: 15, c: 15 };
    expect(patchHandCounts(previous, ['a', 'b', 'c'], 'b', 14)).toEqual({
      a: 15,
      b: 14,
      c: 15,
    });
  });
});
