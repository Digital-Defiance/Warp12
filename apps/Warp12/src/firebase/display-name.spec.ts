import { describe, expect, it } from 'vitest';

import {
  allocateUniqueCallSign,
  isCallSignTaken,
  normalizeCallSign,
} from './display-name.js';

describe('display-name', () => {
  it('compares call signs case-insensitively', () => {
    expect(normalizeCallSign('  Armstrong  ')).toBe('armstrong');
    expect(isCallSignTaken([{ displayName: 'Armstrong' }], 'armstrong')).toBe(true);
  });

  it('keeps a unique requested call sign', () => {
    expect(
      allocateUniqueCallSign([{ displayName: 'Armstrong' }], 'Lovell')
    ).toBe('Lovell');
  });

  it('suffixes when the call sign is already aboard', () => {
    const roster = [{ displayName: 'Armstrong' }];
    expect(allocateUniqueCallSign(roster, 'Armstrong')).toBe('Armstrong (2)');
    expect(
      allocateUniqueCallSign(
        [...roster, { displayName: 'Armstrong (2)' }],
        'Armstrong'
      )
    ).toBe('Armstrong (3)');
  });
});
