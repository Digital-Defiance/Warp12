/**
 * Runtime platform helpers for Warp Ops (desktop Tauri + web).
 *
 * `TAURI_ENV_PLATFORM` is injected at build time by the Tauri CLI.
 * It is undefined for the plain web build (ops.iwdf.org).
 */

export function tauriPlatform(): string | undefined {
  return import.meta.env.TAURI_ENV_PLATFORM as string | undefined;
}

function hasTauriGlobals(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

/** True when running inside the Tauri desktop webview. */
export function isTauriRuntime(): boolean {
  return Boolean(tauriPlatform()) || hasTauriGlobals();
}
