import { describe, expect, it } from 'vitest';

import {
  HE_PRONOUNS,
  SHE_PRONOUNS,
  THEY_PRONOUNS,
  parseCustomPronounSlash,
  pronounKeepVerb,
  resolvePronounForms,
} from './pronouns.js';

describe('pronouns', () => {
  it('defaults to they/them/their', () => {
    expect(resolvePronounForms(undefined)).toEqual(THEY_PRONOUNS);
    expect(pronounKeepVerb(THEY_PRONOUNS)).toBe('keep');
    expect(pronounKeepVerb(SHE_PRONOUNS)).toBe('keeps');
    expect(pronounKeepVerb(HE_PRONOUNS)).toBe('keeps');
  });

  it('parses custom slash forms', () => {
    expect(parseCustomPronounSlash('xe/xem/xyr')).toEqual({
      subject: 'xe',
      object: 'xem',
      possessive: 'xyr',
      possessiveIndependent: 'xyr',
      plural: false,
    });
    expect(parseCustomPronounSlash('xe/xem/xyr/xyrs')?.possessiveIndependent).toBe(
      'xyrs'
    );
    expect(parseCustomPronounSlash('nope')).toBeNull();
  });
});
