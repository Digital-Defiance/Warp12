import { describe, expect, it } from 'vitest';

import { stripUndefined } from './strip-undefined.js';

describe('stripUndefined', () => {
  it('removes undefined fields from nested objects', () => {
    expect(
      stripUndefined({
        id: 'ai:riker',
        isAi: true,
        skill: undefined,
        useLookahead: undefined,
        nested: { keep: 1, drop: undefined },
      })
    ).toEqual({
      id: 'ai:riker',
      isAi: true,
      nested: { keep: 1 },
    });
  });

  it('preserves null values', () => {
    expect(stripUndefined({ roundWinnerId: null })).toEqual({
      roundWinnerId: null,
    });
  });
});
