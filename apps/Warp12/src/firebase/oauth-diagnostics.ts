/**
 * Persist native Google OAuth step breadcrumbs so Android/iOS release builds
 * can be diagnosed without a dev webview console.
 *
 * Never store id tokens, access tokens, auth codes, or client secrets.
 */

const STORAGE_KEY = 'warp12.oauthDiagnostics.v1';
const MAX_ENTRIES = 100;

export interface OauthDiagEntry {
  readonly at: string;
  readonly step: string;
  readonly detail?: string;
}

function redactDetail(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    const raw =
      typeof value === 'string'
        ? value
        : JSON.stringify(value, (_key, nested) => {
            if (typeof nested === 'string') {
              return nested
                .replace(/code=[^&\s]+/gi, 'code=<redacted>')
                .replace(/id_token=[^&\s]+/gi, 'id_token=<redacted>')
                .replace(/access_token=[^&\s]+/gi, 'access_token=<redacted>')
                .replace(/client_secret=[^&\s]+/gi, 'client_secret=<redacted>');
            }
            return nested;
          });
    return raw
      .replace(/code=[^&\s]+/gi, 'code=<redacted>')
      .replace(/"idToken"\s*:\s*"[^"]*"/gi, '"idToken":"<redacted>"')
      .replace(/"accessToken"\s*:\s*"[^"]*"/gi, '"accessToken":"<redacted>"')
      .slice(0, 800);
  } catch {
    return '[unserializable]';
  }
}

export function readOauthDiagnostics(): readonly OauthDiagEntry[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is OauthDiagEntry =>
        Boolean(
          entry &&
            typeof entry === 'object' &&
            typeof (entry as OauthDiagEntry).at === 'string' &&
            typeof (entry as OauthDiagEntry).step === 'string'
        )
    );
  } catch {
    return [];
  }
}

export function clearOauthDiagnostics(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export function appendOauthDiagnostic(
  step: string,
  detail?: unknown
): OauthDiagEntry {
  const entry: OauthDiagEntry = {
    at: new Date().toISOString(),
    step,
    detail: redactDetail(detail),
  };
  if (typeof localStorage === 'undefined') {
    return entry;
  }
  try {
    const next = [...readOauthDiagnostics(), entry].slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  return entry;
}

export function formatOauthDiagnostics(
  entries: readonly OauthDiagEntry[] = readOauthDiagnostics()
): string {
  if (entries.length === 0) {
    return 'No sign-in steps recorded yet.';
  }
  return entries
    .map((entry) => {
      const time = entry.at.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
      return entry.detail
        ? `${time}  ${entry.step}  ${entry.detail}`
        : `${time}  ${entry.step}`;
    })
    .join('\n');
}
