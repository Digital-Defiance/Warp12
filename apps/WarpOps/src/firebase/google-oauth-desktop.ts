/**
 * Desktop Google OAuth for the Warp Ops Tauri app.
 *
 * Firebase `signInWithPopup` cannot work inside the embedded WKWebView.
 * Same loopback flow as The Bridge: system browser → `http://127.0.0.1:<port>`
 * → Rust one-shot server → `signInWithCredential`.
 *
 * Requires `VITE_GOOGLE_DESKTOP_CLIENT_ID` (+ secret) from `apps/Warp12/.env`
 * (Vite `envDir` for WarpOps points there).
 */

export interface GoogleNativeTokens {
  idToken: string;
  accessToken: string | null;
}

export class GoogleNativeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleNativeAuthError';
  }
}

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

interface OAuthClientConfig {
  clientId: string;
  clientSecret?: string;
}

function resolveDesktopClientConfig(): OAuthClientConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const clientId =
    env.VITE_GOOGLE_DESKTOP_CLIENT_ID ?? env.VITE_GOOGLE_ANDROID_CLIENT_ID;
  if (!clientId) {
    throw new GoogleNativeAuthError(
      'Missing VITE_GOOGLE_DESKTOP_CLIENT_ID — Google Desktop OAuth is not configured.'
    );
  }
  return {
    clientId,
    clientSecret:
      env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET ??
      env.VITE_GOOGLE_ANDROID_CLIENT_SECRET,
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64UrlEncode(new Uint8Array(digest));
}

/** Extract authorization code from a loopback redirect URL. */
export function parseRedirectCode(
  raw: string,
  expectedState: string
): string | null {
  const queryIndex = raw.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }
  const params = new URLSearchParams(raw.slice(queryIndex + 1));
  if (params.get('state') !== expectedState) {
    return null;
  }
  const error = params.get('error');
  if (error) {
    throw new GoogleNativeAuthError(`Google denied the request: ${error}`);
  }
  return params.get('code');
}

async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  config: OAuthClientConfig,
  redirectUri: string
): Promise<GoogleNativeTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (err) {
    throw new GoogleNativeAuthError(
      `Token exchange failed (network): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const rawBody = await response.text();
  if (!response.ok) {
    throw new GoogleNativeAuthError(
      `Token exchange failed (${response.status}): ${rawBody.slice(0, 300)}`
    );
  }

  const json = JSON.parse(rawBody) as {
    id_token?: string;
    access_token?: string;
  };
  if (!json.id_token) {
    throw new GoogleNativeAuthError('Google did not return an ID token.');
  }
  return { idToken: json.id_token, accessToken: json.access_token ?? null };
}

/**
 * Run desktop Google OAuth (system browser + loopback) and return tokens.
 * Only valid inside the Tauri runtime.
 */
export async function runDesktopGoogleOAuth(): Promise<GoogleNativeTokens> {
  const config = resolveDesktopClientConfig();
  const { invoke } = await import('@tauri-apps/api/core');
  const { openUrl } = await import('@tauri-apps/plugin-opener');

  const port = await invoke<number>('start_oauth_server');
  const redirectUri = `http://127.0.0.1:${port}`;

  const verifier = randomString();
  const challenge = await pkceChallenge(verifier);
  const state = randomString(16);
  const nonce = randomString(16);

  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    prompt: 'select_account',
  }).toString();

  const redirectPromise = invoke<string>('await_oauth_redirect', { port });
  await openUrl(authUrl.toString());

  const redirectUrl = await redirectPromise;
  const code = parseRedirectCode(redirectUrl, state);
  if (!code) {
    throw new GoogleNativeAuthError(
      'The sign-in redirect did not contain an authorization code.'
    );
  }
  return exchangeCodeForTokens(code, verifier, config, redirectUri);
}
