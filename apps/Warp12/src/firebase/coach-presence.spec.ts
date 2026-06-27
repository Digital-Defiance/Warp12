import { describe, expect, it } from 'vitest';

import {
  COACH_FLASH_MS,
  resolveCoachIndicator,
  type CoachPresence,
} from './coach-presence.js';

describe('resolveCoachIndicator', () => {
  const now = Date.parse('2026-06-27T12:00:00.000Z');

  it('returns null when the signal is from another round', () => {
    const presence: CoachPresence = {
      coachRequestedAt: '2026-06-27T11:59:30.000Z',
      coachRoundNumber: 2,
      coachUsedThisRound: true,
    };
    expect(resolveCoachIndicator(presence, 3, now)).toBeNull();
  });

  it('flashes briefly after a coach request', () => {
    const presence: CoachPresence = {
      coachRequestedAt: '2026-06-27T11:59:40.000Z',
      coachRoundNumber: 3,
      coachUsedThisRound: true,
    };
    expect(resolveCoachIndicator(presence, 3, now)).toEqual({
      flash: true,
      usedThisRound: true,
    });
  });

  it('keeps the round badge after the flash window', () => {
    const presence: CoachPresence = {
      coachRequestedAt: new Date(now - COACH_FLASH_MS - 1_000).toISOString(),
      coachRoundNumber: 3,
      coachUsedThisRound: true,
    };
    expect(resolveCoachIndicator(presence, 3, now)).toEqual({
      flash: false,
      usedThisRound: true,
    });
  });
});
