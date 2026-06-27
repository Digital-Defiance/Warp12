import { describe, expect, it } from 'vitest';

import {
  allocateUniqueCallSign,
  isCallSignTaken,
  normalizeCallSign,
} from './display-name.js';

describe('display-name', () => {
  it('compares call signs case-insensitively', () => {
    expect(normalizeCallSign('  Picard  ')).toBe('picard');
    expect(isCallSignTaken([{ displayName: 'Picard' }], 'picard')).toBe(true);
  });

  it('keeps a unique requested call sign', () => {
    expect(
      allocateUniqueCallSign([{ displayName: 'Picard' }], 'Riker')
    ).toBe('Riker');
  });

  it('suffixes when the call sign is already aboard', () => {
    const roster = [{ displayName: 'Picard' }];
    expect(allocateUniqueCallSign(roster, 'Picard')).toBe('Picard (2)');
    expect(
      allocateUniqueCallSign(
        [...roster, { displayName: 'Picard (2)' }],
        'Picard'
      )
    ).toBe('Picard (3)');
  });
});
