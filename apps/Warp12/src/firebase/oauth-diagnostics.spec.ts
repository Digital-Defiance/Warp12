import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  appendOauthDiagnostic,
  clearOauthDiagnostics,
  formatOauthDiagnostics,
  readOauthDiagnostics,
} from './oauth-diagnostics.js';

describe('oauth-diagnostics', () => {
  beforeEach(() => {
    clearOauthDiagnostics();
  });

  afterEach(() => {
    clearOauthDiagnostics();
  });

  it('persists steps and redacts auth codes', () => {
    appendOauthDiagnostic('awaitRedirectCode: examining URL', {
      url: 'com.googleusercontent.apps.abc:/oauth2redirect?code=SUPERSECRET&state=x',
    });
    const entries = readOauthDiagnostics();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.step).toBe('awaitRedirectCode: examining URL');
    expect(entries[0]?.detail).toContain('code=<redacted>');
    expect(entries[0]?.detail).not.toContain('SUPERSECRET');
  });

  it('formats a readable dump for the Profile panel', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T04:00:00.000Z'));
    appendOauthDiagnostic('runNativeGoogleOAuth', { platform: 'android' });
    vi.useRealTimers();

    const text = formatOauthDiagnostics();
    expect(text).toContain('runNativeGoogleOAuth');
    expect(text).toContain('android');
  });
});
