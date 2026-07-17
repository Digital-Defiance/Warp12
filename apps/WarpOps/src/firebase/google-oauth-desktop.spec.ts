import { describe, expect, it } from 'vitest';

import { parseRedirectCode } from './google-oauth-desktop';

describe('parseRedirectCode', () => {
  const state = 'abc123';

  it('extracts code when state matches', () => {
    expect(
      parseRedirectCode(
        `http://127.0.0.1:54321/?code=tokensecret&state=${state}`,
        state
      )
    ).toBe('tokensecret');
  });

  it('returns null on state mismatch', () => {
    expect(
      parseRedirectCode(
        'http://127.0.0.1:54321/?code=tokensecret&state=other',
        state
      )
    ).toBeNull();
  });

  it('throws when Google returns an error', () => {
    expect(() =>
      parseRedirectCode(
        `http://127.0.0.1:54321/?error=access_denied&state=${state}`,
        state
      )
    ).toThrow(/denied/i);
  });
});
