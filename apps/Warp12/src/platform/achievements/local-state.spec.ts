import { afterEach, describe, expect, it } from 'vitest';

import {
  getAchievementProgressLocally,
  isAchievementUnlockedLocally,
  markAchievementUnlockedLocally,
  resetAchievementLocalState,
  setAchievementProgressLocally,
} from './local-state.js';

describe('achievement local state', () => {
  afterEach(() => {
    resetAchievementLocalState();
  });

  it('tracks unlocks without duplicates', () => {
    expect(isAchievementUnlockedLocally('first_launch')).toBe(false);
    markAchievementUnlockedLocally('first_launch');
    markAchievementUnlockedLocally('first_launch');
    expect(isAchievementUnlockedLocally('first_launch')).toBe(true);
  });

  it('clamps incremental progress', () => {
    expect(setAchievementProgressLocally('rated_sector_10', 3, 10)).toBe(3);
    expect(getAchievementProgressLocally('rated_sector_10')).toBe(3);
    expect(setAchievementProgressLocally('rated_sector_10', 99, 10)).toBe(10);
  });
});
