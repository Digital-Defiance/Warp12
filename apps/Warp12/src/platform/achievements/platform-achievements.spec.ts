import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { unlockAchievement } from './platform-achievements.js';
import { isAchievementUnlockedLocally, resetAchievementLocalState } from './local-state.js';

const invokeMock = vi.fn();

vi.mock('../../firebase/platform.js', () => ({
  isTauriRuntime: () => true,
  isTauriMobile: () => true,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('unlockAchievement', () => {
  beforeEach(() => {
    resetAchievementLocalState();
    invokeMock.mockReset();
  });

  afterEach(() => {
    resetAchievementLocalState();
  });

  it('marks local unlock only after native success', async () => {
    invokeMock.mockResolvedValueOnce({ status: 'error', detail: 'sign-in required' });

    const result = await unlockAchievement('first_launch');

    expect(result.status).toBe('error');
    expect(isAchievementUnlockedLocally('first_launch')).toBe(false);

    invokeMock.mockResolvedValueOnce({ status: 'unlocked', detail: 'first_launch' });

    const retry = await unlockAchievement('first_launch');

    expect(retry.status).toBe('unlocked');
    expect(isAchievementUnlockedLocally('first_launch')).toBe(true);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
