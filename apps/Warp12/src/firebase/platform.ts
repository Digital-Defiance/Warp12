/**
 * Runtime platform helpers.
 *
 * `TAURI_ENV_PLATFORM` is injected at build time by the Tauri CLI (e.g. "ios",
 * "android", "macos"). It is undefined for the plain web build.
 */
export function tauriPlatform(): string | undefined {
  return import.meta.env.TAURI_ENV_PLATFORM as string | undefined;
}

/** True when the Tauri runtime globals are present in the webview. */
function hasTauriGlobals(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

/** True when running inside the Tauri runtime (desktop or mobile webview). */
export function isTauriRuntime(): boolean {
  return Boolean(tauriPlatform()) || hasTauriGlobals();
}

/**
 * True on Tauri mobile (iOS/Android), where webview OAuth popups do not work.
 *
 * The build-time `TAURI_ENV_PLATFORM` is the reliable signal (note iPadOS reports
 * a desktop user-agent, so UA sniffing alone cannot detect an iPad). The UA
 * fallback only applies when we are demonstrably inside the Tauri runtime but the
 * build-time platform was not injected.
 */
export function isTauriMobile(): boolean {
  const platform = tauriPlatform();
  if (platform === 'ios' || platform === 'android') {
    return true;
  }
  if (platform) {
    return false; // desktop Tauri build
  }
  if (!hasTauriGlobals()) {
    return false;
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /iPhone|iPad|iPod|Android/i.test(ua);
}

/** True on Tauri desktop (Windows / macOS / Linux), not iOS/Android. */
export function isTauriDesktop(): boolean {
  return isTauriRuntime() && !isTauriMobile();
}

/** Windows desktop Tauri — no app menu; Quit belongs in Options. */
export function isTauriWindows(): boolean {
  if (tauriPlatform() === 'windows') {
    return true;
  }
  // Runtime fallback when build-time platform is missing.
  if (!isTauriDesktop()) {
    return false;
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Windows/i.test(ua);
}
