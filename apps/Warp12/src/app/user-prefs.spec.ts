import { describe, it, expect, beforeEach } from 'vitest';
import { readUserPrefs, writeUserPrefs } from './user-prefs.js';

describe('user-prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when no preferences are stored', () => {
    const prefs = readUserPrefs();
    expect(prefs).toEqual({
      showAdvancedStats: false,
    });
  });

  it('persists showAdvancedStats preference', () => {
    writeUserPrefs({ showAdvancedStats: true });
    const prefs = readUserPrefs();
    expect(prefs.showAdvancedStats).toBe(true);
  });

  it('merges partial updates with existing preferences', () => {
    writeUserPrefs({ showAdvancedStats: true });
    writeUserPrefs({ showAdvancedStats: false });
    const prefs = readUserPrefs();
    expect(prefs.showAdvancedStats).toBe(false);
  });

  it('handles invalid stored data gracefully', () => {
    localStorage.setItem('warp12-user-prefs', 'invalid json');
    const prefs = readUserPrefs();
    expect(prefs).toEqual({
      showAdvancedStats: false,
    });
  });

  it('ignores non-boolean showAdvancedStats values', () => {
    localStorage.setItem(
      'warp12-user-prefs',
      JSON.stringify({ showAdvancedStats: 'true' })
    );
    const prefs = readUserPrefs();
    expect(prefs.showAdvancedStats).toBe(false);
  });
});
