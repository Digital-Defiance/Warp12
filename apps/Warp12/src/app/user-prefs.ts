/**
 * User preference storage utilities.
 * Preferences are stored in localStorage and persist across sessions.
 */

const STORAGE_KEY = 'warp12-user-prefs';

export interface UserPreferences {
  /** Show advanced rating statistics (μ, σ) in profile */
  showAdvancedStats: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  showAdvancedStats: false,
};

/**
 * Read user preferences from localStorage.
 * Returns defaults if storage is unavailable or contains invalid data.
 */
export function readUserPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFS };
    }
    const stored = JSON.parse(raw);
    return {
      showAdvancedStats: typeof stored.showAdvancedStats === 'boolean' 
        ? stored.showAdvancedStats 
        : DEFAULT_PREFS.showAdvancedStats,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/**
 * Write a partial update to user preferences.
 * Merges with existing preferences.
 */
export function writeUserPrefs(patch: Partial<UserPreferences>): void {
  const current = readUserPrefs();
  const next = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}
