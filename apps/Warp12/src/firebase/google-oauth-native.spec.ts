import { describe, expect, it } from 'vitest';

import {
  GoogleNativeAuthError,
  parseRedirectCode,
} from './google-oauth-native.js';

const STATE = 'expected-state-123';

describe('parseRedirectCode', () => {
  it('extracts the code from a desktop loopback redirect URL', () => {
    const url = `http://127.0.0.1:49221/?state=${STATE}&code=auth-code-abc&scope=email`;
    expect(parseRedirectCode(url, STATE)).toBe('auth-code-abc');
  });

  it('extracts the code from a mobile custom-scheme redirect URL', () => {
    const url = `com.googleusercontent.apps.123-abc:/oauth2redirect?code=auth-code-xyz&state=${STATE}`;
    expect(parseRedirectCode(url, STATE)).toBe('auth-code-xyz');
  });

  it('returns null when the state does not match (CSRF guard)', () => {
    const url = `http://127.0.0.1:49221/?state=someone-elses-state&code=auth-code-abc`;
    expect(parseRedirectCode(url, STATE)).toBeNull();
  });

  it('returns null when there is no query string', () => {
    expect(parseRedirectCode('http://127.0.0.1:49221/', STATE)).toBeNull();
  });

  it('returns null when the matching redirect carries no code', () => {
    const url = `http://127.0.0.1:49221/?state=${STATE}`;
    expect(parseRedirectCode(url, STATE)).toBeNull();
  });

  it('throws when Google returned an error on the matching redirect', () => {
    const url = `http://127.0.0.1:49221/?state=${STATE}&error=access_denied`;
    expect(() => parseRedirectCode(url, STATE)).toThrow(GoogleNativeAuthError);
    expect(() => parseRedirectCode(url, STATE)).toThrow(/access_denied/);
  });

  it('ignores an error param when the state does not match', () => {
    const url = `http://127.0.0.1:49221/?state=wrong&error=access_denied`;
    expect(parseRedirectCode(url, STATE)).toBeNull();
  });
});
