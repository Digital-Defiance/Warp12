import { describe, expect, it } from 'vitest';
import { resolveHouseRules, type GameState } from 'warp12-engine';

import { serializePublicGame } from './serialize.js';

describe('serialize round rule fields', () => {
  it('persists mandatoryPlay, pendingRoundWin, and roundBlocked', () => {
    const state = {
      id: 'test',
      phase: 'active',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 0,
      houseRules: resolveHouseRules(),
      captains: [{ id: 'a', displayName: 'A', pointsScore: 0 }],
      modules: {
        qContinuum: { enabled: false, activeFlash: null },
        salamanderPenalty: { enabled: false },
        subspaceFracture: { enabled: false, scope: 'own-trail' },
      },
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'ended',
        activePlayerId: 'a',
        turnOrder: ['a', 'b'],
        hands: { a: [], b: [] },
        unchartedSectors: [],
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        qPendingInvoker: null,
        qEffects: null,
        qGamblePending: null,
        mandatoryPlay: { playerId: 'a', coordinate: { low: 6, high: 12 } },
        pendingRoundWin: { playerId: 'a', routeKind: 'warp-trail' as const },
        roundBlocked: true,
        roundStarterOpening: null,
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      },
    } satisfies GameState;

    const doc = serializePublicGame(state);

    expect(doc.round?.mandatoryPlay).toEqual({
      playerId: 'a',
      coordinate: { low: 6, high: 12 },
    });
    expect(doc.round?.pendingRoundWin).toEqual({
      playerId: 'a',
      routeKind: 'warp-trail',
    });
    expect(doc.round?.roundBlocked).toBe(true);
  });
});
