import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  defaultLogVisibilityMode,
  isLogVisibilityMode,
  logModeToScope,
  readLogVisibilityMode,
  scopeToLogMode,
  writeLogVisibilityMode,
} from './log-visibility-prefs.js';

describe('log-visibility-prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults desktop to all and compact to off', () => {
    expect(defaultLogVisibilityMode(false)).toBe('all');
    expect(defaultLogVisibilityMode(true)).toBe('off');
  });

  it('persists and reads log mode including commentator', () => {
    writeLogVisibilityMode('commentator');
    expect(readLogVisibilityMode(false)).toBe('commentator');
    expect(isLogVisibilityMode('commentator')).toBe(true);
    expect(isLogVisibilityMode('nope')).toBe(false);
  });

  it('maps mode ↔ dialog scope', () => {
    expect(logModeToScope('off')).toBe('all');
    expect(logModeToScope('mine')).toBe('mine');
    expect(logModeToScope('commentator')).toBe('commentator');
    expect(scopeToLogMode('commentator')).toBe('commentator');
  });
});
