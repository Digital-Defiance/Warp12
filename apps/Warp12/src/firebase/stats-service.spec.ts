import { describe, expect, it } from 'vitest';

import {
  hasStartingTeiPlacedForObjective,
  incrementLocalAiSkillStats,
  isReplayableLocalAiMatch,
  needsAcademyPlacement,
  needsAcademyPlacementForObjective,
  previewLocalAiMatchReport,
  stripUndefinedFieldsForFirestore,
} from './stats-service.js';
import { emptyLocalAiSkillStats, objectiveRatingStats as objectiveTeiStats } from './stats-schema.js';

describe('needsAcademyPlacementForObjective', () => {
  it('is true per track until placement is saved or a rated match is played', () => {
    expect(needsAcademyPlacementForObjective(null, 'go-out')).toBe(true);
    expect(needsAcademyPlacementForObjective(null, 'points')).toBe(true);

    const partial = {
      uid: 'u',
      displayName: 'You',
      matchesCompleted: 0,
      matchesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      totalPoints: 0,
      startingRating: { goOut: { mu: 28, sigma: 8.33 } },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(needsAcademyPlacementForObjective(partial, 'go-out')).toBe(false);
    expect(needsAcademyPlacementForObjective(partial, 'points')).toBe(true);
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
      totalPoints: 0,
      localAi: {
        ensign: stats,
        lieutenant: emptyLocalAiSkillStats(),
        commander: emptyLocalAiSkillStats(),
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(needsAcademyPlacementForObjective(doc, 'go-out')).toBe(false);
    expect(needsAcademyPlacementForObjective(doc, 'points')).toBe(true);
  });
});

describe('hasStartingTeiPlacedForObjective', () => {
  it('detects per-track seeds', () => {
    expect(
      hasStartingTeiPlacedForObjective(
        { startingRating: { points: { mu: 28, sigma: 8.33 } } } as never,
        'points'
      )
    ).toBe(true);
    expect(
      hasStartingTeiPlacedForObjective(
        { startingRating: { points: { mu: 28, sigma: 8.33 } } } as never,
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
        totalPoints: 0,
        startingRating: { goOut: { mu: 25, sigma: 8.33 }, points: { mu: 25, sigma: 8.33 } },
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).toBe(false);
  });
});

describe.skip('incrementLocalAiSkillStats (OpenSkill tests in engine)', () => {
  // OpenSkill tests are in libs/engine/src/lib/rating/*.spec.ts
  it('tracks go-out and points TEI separately', () => {
    let stats = incrementLocalAiSkillStats(emptyLocalAiSkillStats(), {
      skill: 'ensign',
      objective: 'go-out',
      won: true,
      advisorUsed: false,
    });
    stats = incrementLocalAiSkillStats(stats, {
      skill: 'ensign',
      objective: 'points',
      won: false,
      advisorUsed: false,
    });

    expect(objectiveTeiStats(stats, 'go-out').unassistedTei).toBeGreaterThan(1000);
    expect(objectiveTeiStats(stats, 'points').unassistedTei).toBeLessThan(1000);
    expect(objectiveTeiStats(stats, 'go-out').unassistedMatches).toBe(1);
    expect(objectiveTeiStats(stats, 'points').unassistedMatches).toBe(1);
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
        objective: 'points',
        advisorUsed: false,
        seed: 1,
        config: {} as never,
        humanActions: [],
      },
      true,
      1100
    );
    expect(report.rated).toBe(true);
    expect(report.teiBefore).toBe(1100);
    expect(report.teiDelta).toBeGreaterThan(0);
  });
});

describe.skip('resolveEffectivePlayerTei (Legacy - migrated to OpenSkill)', () => {
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
      totalPoints: 0,
      startingTei: undefined,
      bestRoundTimeMs: undefined,
      localAi: {},
      lastPlayedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      matchHistory: [
        {
          playedAt: '2026-01-01T00:00:00.000Z',
          objective: 'points',
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

describe('isReplayableLocalAiMatch', () => {
  const base = {
    skill: 'lieutenant' as const,
    objective: 'go-out' as const,
    advisorUsed: false,
    opponentOmega: false,
    seed: 42,
    config: {
      humanId: 'you',
      humanName: 'You',
      humanCaptains: [{ id: 'you', displayName: 'You' }],
      playerCount: 4,
      objective: 'go-out' as const,
      campaignRounds: 13,
      modules: { salamanderPenalty: false, continuum: false, subspaceFracture: false },
      aiCaptains: [{ id: 'lovell', displayName: 'Lovell', skill: 'lieutenant' as const }],
    },
    humanActions: [
      { type: 'PASS_TURN' as const, playerId: 'you' },
    ],
  };

  it('accepts replay payloads with human moves', () => {
    expect(isReplayableLocalAiMatch(base)).toBe(true);
  });

  it('rejects pass-and-play configs', () => {
    expect(
      isReplayableLocalAiMatch({
        ...base,
        config: {
          ...base.config,
          humanCaptains: [
            { id: 'human:0', displayName: 'Armstrong' },
            { id: 'human:1', displayName: 'Lovell' },
          ],
        },
      })
    ).toBe(false);
  });

  it('rejects legacy rows missing seed, advisorUsed, or humanActions', () => {
    expect(isReplayableLocalAiMatch({ ...base, seed: NaN })).toBe(false);
    expect(isReplayableLocalAiMatch({ ...base, advisorUsed: undefined })).toBe(false);
    expect(
      isReplayableLocalAiMatch({
        ...base,
        humanActions: [{ type: 'END_ROUND', winnerId: 'you' }],
      })
    ).toBe(false);
    expect(
      isReplayableLocalAiMatch({ ...base, humanActions: undefined as never })
    ).toBe(false);
  });

  it('rejects extended-thinking Commander opponents before hitting the server', () => {
    expect(
      isReplayableLocalAiMatch({
        ...base,
        config: {
          ...base.config,
          aiCaptains: [
            {
              id: 'lovell',
              displayName: 'Lovell',
              skill: 'commander',
              extendedThinking: true,
            },
          ],
        },
      })
    ).toBe(false);
  });

  it('allows rated greedy Commander (commander) opponents', () => {
    expect(
      isReplayableLocalAiMatch({
        ...base,
        opponentOmega: true,
        config: {
          ...base.config,
          aiCaptains: [
            {
              id: 'lovell',
              displayName: 'Lovell',
              skill: 'commander',
              omega: true,
            },
          ],
        },
      })
    ).toBe(true);
  });
});
