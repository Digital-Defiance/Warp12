import { describe, expect, it } from 'vitest';

import {
  hasStartingTeiPlacedForObjective,
  incrementLocalAiSkillStats,
  needsAcademyPlacement,
  needsAcademyPlacementForObjective,
  previewLocalAiMatchReport,
  stripUndefinedFieldsForFirestore,
} from './stats-service.js';
import { emptyLocalAiSkillStats, objectiveTeiStats } from './stats-schema.js';
import { resolveEffectivePlayerTei } from './stats-elo.js';

describe('needsAcademyPlacementForObjective', () => {
  it('is true per track until placement is saved or a rated match is played', () => {
    expect(needsAcademyPlacementForObjective(null, 'go-out')).toBe(true);
    expect(needsAcademyPlacementForObjective(null, 'penalty')).toBe(true);

    const partial = {
      uid: 'u',
      displayName: 'You',
      matchesCompleted: 0,
      matchesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      totalPenaltyPoints: 0,
      startingTei: { goOut: 1250 },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(needsAcademyPlacementForObjective(partial, 'go-out')).toBe(false);
    expect(needsAcademyPlacementForObjective(partial, 'penalty')).toBe(true);
    expect(needsAcademyPlacement(partial)).toBe(true);
  });

  it('locks a track after the first unassisted match even without placement', () => {
    let stats = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'ensign',
      objective: 'go-out',
      won: true,
      advisorUsed: false,
    });
    const doc = {
      uid: 'u',
      displayName: 'You',
      matchesCompleted: 1,
      matchesWon: 1,
      roundsPlayed: 0,
      roundsWon: 0,
      totalPenaltyPoints: 0,
      localAi: {
        ensign: stats,
        lieutenant: emptyLocalAiSkillStats(),
        commander: emptyLocalAiSkillStats(),
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(needsAcademyPlacementForObjective(doc, 'go-out')).toBe(false);
    expect(needsAcademyPlacementForObjective(doc, 'penalty')).toBe(true);
  });
});

describe('hasStartingTeiPlacedForObjective', () => {
  it('detects per-track seeds', () => {
    expect(
      hasStartingTeiPlacedForObjective(
        { startingTei: { penalty: 1200 } } as never,
        'penalty'
      )
    ).toBe(true);
    expect(
      hasStartingTeiPlacedForObjective(
        { startingTei: { penalty: 1200 } } as never,
        'go-out'
      )
    ).toBe(false);
  });
});

describe('needsAcademyPlacement', () => {
  it('is true when either track still needs placement', () => {
    expect(needsAcademyPlacement(null)).toBe(true);
    expect(
      needsAcademyPlacement({
        uid: 'u',
        displayName: 'You',
        matchesCompleted: 0,
        matchesWon: 0,
        roundsPlayed: 0,
        roundsWon: 0,
        totalPenaltyPoints: 0,
        startingTei: { goOut: 1100, penalty: 1100 },
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).toBe(false);
  });
});

describe('incrementLocalAiSkillStats', () => {
  it('tracks go-out and penalty TEI separately', () => {
    let stats = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'ensign',
      objective: 'go-out',
      won: true,
      advisorUsed: false,
    });
    stats = incrementLocalAiSkillStats(stats, {
      skill: 'ensign',
      objective: 'penalty',
      won: false,
      advisorUsed: false,
    });

    expect(objectiveTeiStats(stats, 'go-out').unassistedTei).toBeGreaterThan(1000);
    expect(objectiveTeiStats(stats, 'penalty').unassistedTei).toBeLessThan(1000);
    expect(objectiveTeiStats(stats, 'go-out').unassistedMatches).toBe(1);
    expect(objectiveTeiStats(stats, 'penalty').unassistedMatches).toBe(1);
    expect(stats).not.toHaveProperty('unassistedTei');
  });

  it('does not update TEI when the advisor was used', () => {
    const next = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'commander',
      objective: 'go-out',
      won: true,
      advisorUsed: true,
    });
    expect(next.advisorMatches).toBe(1);
    expect(next.goOut).toBeUndefined();
    expect(next.penalty).toBeUndefined();
  });

  it('seeds the first rated game from starting TEI', () => {
    const next = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'lieutenant',
      objective: 'go-out',
      won: true,
      advisorUsed: false,
    }, { startingTei: 1150 });
    expect(objectiveTeiStats(next, 'go-out').unassistedTei).toBeGreaterThan(1150);
  });

  it('previewLocalAiMatchReport returns tei delta', () => {
    const report = previewLocalAiMatchReport(
      emptyLocalAiSkillStats(),
      {
        uid: 'u',
        displayName: 'You',
        skill: 'commander',
        objective: 'penalty',
        won: true,
        advisorUsed: false,
      },
      1100
    );
    expect(report.rated).toBe(true);
    expect(report.teiBefore).toBe(1100);
    expect(report.teiDelta).toBeGreaterThan(0);
  });
});

describe('resolveEffectivePlayerTei', () => {
  it('uses starting TEI only before the first rated game', () => {
    expect(resolveEffectivePlayerTei(undefined, 0, 1180)).toBe(1180);
    expect(resolveEffectivePlayerTei(1220, 2, 1180)).toBe(1220);
  });
});

describe('Firestore player stats payload', () => {
  it('omits undefined optional fields such as startingTei', () => {
    const sanitized = stripUndefinedFieldsForFirestore({
      uid: 'u1',
      displayName: 'Captain',
      matchesCompleted: 1,
      matchesWon: 1,
      roundsPlayed: 0,
      roundsWon: 0,
      totalPenaltyPoints: 0,
      startingTei: undefined,
      bestRoundTimeMs: undefined,
      localAi: {},
      lastPlayedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      matchHistory: [
        {
          playedAt: '2026-01-01T00:00:00.000Z',
          objective: 'penalty',
          opponentSkill: 'ensign',
          won: true,
          advisorUsed: false,
          teiBefore: undefined,
          teiAfter: 1012,
          teiDelta: 12,
        },
      ],
    });
    expect(sanitized).not.toHaveProperty('startingTei');
    expect(sanitized).not.toHaveProperty('bestRoundTimeMs');
    expect(sanitized.matchHistory?.[0]).not.toHaveProperty('teiBefore');
    expect(sanitized.matchHistory?.[0]?.teiAfter).toBe(1012);
  });
});
