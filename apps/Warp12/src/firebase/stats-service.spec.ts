import { describe, expect, it } from 'vitest';

import {
  incrementLocalAiSkillStats,
  previewLocalAiMatchReport,
} from './stats-service.js';
import { emptyLocalAiSkillStats, objectiveEloStats } from './stats-schema.js';
import { resolveEffectivePlayerElo } from './stats-elo.js';

describe('incrementLocalAiSkillStats', () => {
  it('tracks go-out and penalty ELO separately', () => {
    let stats = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'beginner',
      objective: 'go-out',
      won: true,
      advisorUsed: false,
    });
    stats = incrementLocalAiSkillStats(stats, {
      skill: 'beginner',
      objective: 'penalty',
      won: false,
      advisorUsed: false,
    });

    expect(objectiveEloStats(stats, 'go-out').unassistedElo).toBeGreaterThan(1000);
    expect(objectiveEloStats(stats, 'penalty').unassistedElo).toBeLessThan(1000);
    expect(objectiveEloStats(stats, 'go-out').unassistedMatches).toBe(1);
    expect(objectiveEloStats(stats, 'penalty').unassistedMatches).toBe(1);
    expect(stats).not.toHaveProperty('unassistedElo');
  });

  it('does not update ELO when the advisor was used', () => {
    const next = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'advanced',
      objective: 'go-out',
      won: true,
      advisorUsed: true,
    });
    expect(next.advisorMatches).toBe(1);
    expect(next.goOut).toBeUndefined();
    expect(next.penalty).toBeUndefined();
  });

  it('seeds the first rated game from starting ELO', () => {
    const next = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'intermediate',
      objective: 'go-out',
      won: true,
      advisorUsed: false,
    }, { startingElo: 1150 });
    expect(objectiveEloStats(next, 'go-out').unassistedElo).toBeGreaterThan(1150);
  });

  it('previewLocalAiMatchReport returns elo delta', () => {
    const report = previewLocalAiMatchReport(
      emptyLocalAiSkillStats(),
      {
        uid: 'u',
        displayName: 'You',
        skill: 'advanced',
        objective: 'penalty',
        won: true,
        advisorUsed: false,
      },
      1100
    );
    expect(report.rated).toBe(true);
    expect(report.eloBefore).toBe(1100);
    expect(report.eloDelta).toBeGreaterThan(0);
  });
});

describe('resolveEffectivePlayerElo', () => {
  it('uses starting ELO only before the first rated game', () => {
    expect(resolveEffectivePlayerElo(undefined, 0, 1180)).toBe(1180);
    expect(resolveEffectivePlayerElo(1220, 2, 1180)).toBe(1220);
  });
});
