import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  DEFAULT_CAPTAIN_PRONOUNS,
  isCaptainPronounPreference,
  pronounFormsFromPreference,
  readCaptainPronounsLocal,
  writeCaptainPronounsLocal,
} from './captain-pronouns.js';

describe('captain-pronouns preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to they and persists custom forms', () => {
    expect(readCaptainPronounsLocal()).toEqual(DEFAULT_CAPTAIN_PRONOUNS);
    writeCaptainPronounsLocal({ preset: 'she' });
    expect(readCaptainPronounsLocal()).toEqual({ preset: 'she' });
    writeCaptainPronounsLocal({ preset: 'custom', custom: 'xe/xem/xyr' });
    expect(readCaptainPronounsLocal()).toEqual({
      preset: 'custom',
      custom: 'xe/xem/xyr',
    });
    expect(pronounFormsFromPreference({ preset: 'custom', custom: 'xe/xem/xyr' })).toMatchObject({
      subject: 'xe',
      object: 'xem',
      possessive: 'xyr',
    });
  });

  it('type-guards preferences', () => {
    expect(isCaptainPronounPreference({ preset: 'he' })).toBe(true);
    expect(isCaptainPronounPreference({ preset: 'custom', custom: 'a/b/c' })).toBe(
      true
    );
    expect(isCaptainPronounPreference({ preset: 'nope' })).toBe(false);
  });
});
