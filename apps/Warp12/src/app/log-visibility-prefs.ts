import type { LogVisibilityMode } from './table-viewport.js';

const STORAGE_KEY = 'warp12-comms-log-mode';

const VALID: ReadonlySet<LogVisibilityMode> = new Set([
  'all',
  'mine',
  'commentator',
  'off',
]);

export function isLogVisibilityMode(value: unknown): value is LogVisibilityMode {
  return typeof value === 'string' && VALID.has(value as LogVisibilityMode);
}

/** Desktop default: fleet-wide log. Compact layouts default to silenced. */
export function defaultLogVisibilityMode(compactLayout: boolean): LogVisibilityMode {
  return compactLayout ? 'off' : 'all';
}

export function readLogVisibilityMode(
  compactLayout: boolean
): LogVisibilityMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isLogVisibilityMode(raw)) {
      return raw;
    }
  } catch {
    // private mode / blocked storage
  }
  return defaultLogVisibilityMode(compactLayout);
}

export function writeLogVisibilityMode(mode: LogVisibilityMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

/** Dialog / filter scopes — silence is ticker-only. */
export type GameLogScope = 'all' | 'mine' | 'commentator';

export function logModeToScope(mode: LogVisibilityMode): GameLogScope {
  if (mode === 'mine') {
    return 'mine';
  }
  if (mode === 'commentator') {
    return 'commentator';
  }
  return 'all';
}

export function scopeToLogMode(scope: GameLogScope): LogVisibilityMode {
  return scope;
}
