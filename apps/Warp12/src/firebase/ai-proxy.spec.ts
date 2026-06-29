import type { GameAction } from 'warp12-engine';
import { describe, expect, it } from 'vitest';

import {
  assertActorMaySubmit,
  canHostProxyAiMove,
} from './ai-proxy.js';
import type { FirestoreGameDocument } from './schema.js';

function lobbyDoc(
  overrides: Partial<FirestoreGameDocument> = {}
): FirestoreGameDocument {
  return {
    id: 'ABC123',
    phase: 'active',
    hostId: 'host-uid',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    modules: {
      qContinuum: false,
      salamanderPenalty: true,
      subspaceFracture: true,
      subspaceFractureScope: 'own-trail',
    },
    captainIds: ['host-uid', 'ai:riker'],
    captains: [
      {
        id: 'host-uid',
        displayName: 'Picard',
        penaltyScore: 0,
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'ai:riker',
        displayName: 'Riker',
        penaltyScore: 0,
        joinedAt: '2026-01-01T00:00:00.000Z',
        isAi: true,
        skill: 'intermediate',
      },
    ],
    completedRounds: 0,
    objective: 'penalty',
    campaignRounds: 13,
    maxPlayers: 4,
    round: {
      roundNumber: 1,
      spacedockValue: 12,
      phase: 'playing',
      activePlayerId: 'ai:riker',
      turnOrder: ['host-uid', 'ai:riker'],
      handCounts: { 'host-uid': 15, 'ai:riker': 15 },
      unchartedSectors: [],
      dropToImpulseRequired: false,
      dropToImpulseDeclared: false,
      roundWinnerId: null,
      table: {
        spacedock: { value: 12, placedBy: 'host-uid' },
        warpTrails: [],
        neutralZone: { tiles: [] },
        subspaceFracture: null,
        redAlert: null,
      },
    },
    ...overrides,
  };
}

describe('online AI move proxy', () => {
  it('lets the host submit for an AI captain on that AI turn', () => {
    const doc = lobbyDoc();
    const action: GameAction = {
      type: 'PASS_TURN',
      playerId: 'ai:riker',
    };

    expect(canHostProxyAiMove(doc, 'host-uid', 'ai:riker')).toBe(true);
    expect(assertActorMaySubmit(doc, 'host-uid', action)).toBeNull();
  });

  it('rejects a guest submitting for an AI captain', () => {
    const base = lobbyDoc();
    const doc = lobbyDoc({
      captainIds: ['host-uid', 'guest-uid', 'ai:riker'],
      captains: [
        base.captains[0]!,
        {
          id: 'guest-uid',
          displayName: 'Kirk',
          penaltyScore: 0,
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
        base.captains[1]!,
      ],
    });

    expect(
      assertActorMaySubmit(doc, 'guest-uid', {
        type: 'PASS_TURN',
        playerId: 'ai:riker',
      })
    ).toBe('NOT_YOUR_TURN');
  });

  it('still requires the active player to match the proxied AI', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'host-uid',
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'PASS_TURN',
        playerId: 'ai:riker',
      })
    ).toBe('NOT_YOUR_TURN');
  });

  it('lets the round winner drop to impulse while the round is still open', () => {
    const doc = lobbyDoc({
      captainIds: ['host-uid', 'guest-uid'],
      captains: [
        lobbyDoc().captains[0]!,
        {
          id: 'guest-uid',
          displayName: 'Janeway',
          penaltyScore: 0,
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'guest-uid',
        roundWinnerId: 'guest-uid',
        dropToImpulseRequired: true,
        dropToImpulseDeclared: false,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'guest-uid', {
        type: 'DROP_TO_IMPULSE',
        playerId: 'guest-uid',
      })
    ).toBeNull();
  });

  it('allows drop to impulse when roundWinnerId was not persisted yet', () => {
    const doc = lobbyDoc({
      captainIds: ['host-uid', 'guest-uid'],
      captains: [
        lobbyDoc().captains[0]!,
        {
          id: 'guest-uid',
          displayName: 'Janeway',
          penaltyScore: 0,
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'guest-uid',
        roundWinnerId: null,
        dropToImpulseRequired: true,
        dropToImpulseDeclared: false,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'guest-uid', {
        type: 'DROP_TO_IMPULSE',
        playerId: 'guest-uid',
      })
    ).toBeNull();
  });

  it('allows the host to proxy DROP_TO_IMPULSE for an AI round winner', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'ai:riker',
        roundWinnerId: 'ai:riker',
        dropToImpulseRequired: true,
        dropToImpulseDeclared: false,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'DROP_TO_IMPULSE',
        playerId: 'ai:riker',
      })
    ).toBeNull();
  });

  it('allows END_ROUND with a null winner when the sector is blocked', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        phase: 'ended',
        roundWinnerId: null,
        roundBlocked: true,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'END_ROUND',
        winnerId: null,
      })
    ).toBeNull();
  });

  it('rejects END_ROUND with a winner when the sector is blocked', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        phase: 'ended',
        roundWinnerId: null,
        roundBlocked: true,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'END_ROUND',
        winnerId: 'host-uid',
      })
    ).toBe('ROUND_NOT_PLAYING');
  });
});
