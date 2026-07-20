import { describe, expect, it } from 'vitest';

import {
  WARP_ACHIEVEMENTS,
  getWarpAchievement,
  listEarlyHourAchievements,
  totalGameCenterPoints,
} from './catalog.js';

describe('WARP_ACHIEVEMENTS catalog', () => {
  it('has at least 10 achievements for Play Level Up baseline', () => {
    expect(WARP_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(10);
  });

  it('uses unique stable ids', () => {
    const ids = WARP_ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps Game Center points within Apple caps', () => {
    for (const achievement of WARP_ACHIEVEMENTS) {
      expect(achievement.gameCenterPoints).toBeGreaterThan(0);
      expect(achievement.gameCenterPoints).toBeLessThanOrEqual(100);
    }
    expect(totalGameCenterPoints()).toBeLessThanOrEqual(1000);
  });

  it('has at least 4 early-hour achievements for Quests eligibility', () => {
    expect(listEarlyHourAchievements().length).toBeGreaterThanOrEqual(4);
  });

  it('requires steps when incremental', () => {
    const incremental = WARP_ACHIEVEMENTS.filter((a) => a.steps != null);
    expect(incremental.length).toBeGreaterThan(0);
    for (const achievement of incremental) {
      expect(achievement.steps).toBeGreaterThan(1);
    }
  });

  it('resolves known ids', () => {
    expect(getWarpAchievement('first_launch')?.title).toBe('Bridge Online');
    expect(getWarpAchievement('rated_sector_10')?.steps).toBe(10);
  });
});
