/**
 * Native Sign in with Apple (Tauri iOS / macOS) → tokens for Firebase.
 *
 * Web uses Firebase OAuthProvider popup instead (see auth-actions.ts).
 */
import { getAppleIdCredential } from 'tauri-plugin-siwa-api';

import { appendOauthDiagnostic } from './oauth-diagnostics.js';
import { tauriPlatform } from './platform.js';

export type AppleNativeTokens = {
  idToken: string;
  rawNonce: string;
};

function randomNonce(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

/** True when native SIWA is expected to work (iPhone / iPad / Mac Tauri). */
export function isNativeAppleSignInSupported(): boolean {
  const platform = tauriPlatform();
  return platform === 'ios' || platform === 'darwin';
}

/**
 * Presents the system Sign in with Apple sheet and returns an ID token + the
 * unhashed nonce Firebase expects as `rawNonce`.
 */
export async function runNativeAppleSignIn(): Promise<AppleNativeTokens> {
  if (!isNativeAppleSignInSupported()) {
    throw new Error(
      'Sign in with Apple is available on iPhone, iPad, and Mac builds.'
    );
  }

  const rawNonce = randomNonce();
  const nonce = await sha256Hex(rawNonce);

  appendOauthDiagnostic('apple:siwa:start', {
    platform: tauriPlatform() ?? 'unknown',
  });

  const response = await getAppleIdCredential({
    scope: ['fullName', 'email'],
    nonce,
  });

  const idToken = response.identityToken?.trim();
  if (!idToken) {
    appendOauthDiagnostic('apple:siwa:empty-token');
    throw new Error('Apple did not return an identity token.');
  }

  appendOauthDiagnostic('apple:siwa:ok');
  return { idToken, rawNonce };
}
