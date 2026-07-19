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
      continuum: false,
      salamanderPenalty: true,
      subspaceFracture: true,
      subspaceFractureScope: 'own-trail',
    },
    captainIds: ['host-uid', 'ai:lovell'],
    captains: [
      {
        id: 'host-uid',
        displayName: 'Armstrong',
        pointsScore: 0,
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'ai:lovell',
        displayName: 'Lovell',
        pointsScore: 0,
        joinedAt: '2026-01-01T00:00:00.000Z',
        isAi: true,
        skill: 'lieutenant',
      },
    ],
    completedRounds: 0,
    objective: 'points',
    campaignRounds: 13,
    maxPlayers: 4,
    round: {
      roundNumber: 1,
      spacedockValue: 12,
      phase: 'playing',
      activePlayerId: 'ai:lovell',
      turnOrder: ['host-uid', 'ai:lovell'],
      handCounts: { 'host-uid': 15, 'ai:lovell': 15 },
      unchartedSectors: [],
      allStopRequired: false,
      allStopDeclared: false,
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
      playerId: 'ai:lovell',
    };

    expect(canHostProxyAiMove(doc, 'host-uid', 'ai:lovell')).toBe(true);
    expect(assertActorMaySubmit(doc, 'host-uid', action)).toBeNull();
  });

  it('allows PICK_FROM_PACK during drafting for the current drafter', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        phase: 'drafting',
        activePlayerId: 'host-uid',
        draftState: {
          currentDrafter: 'host-uid',
          draftOrder: ['host-uid', 'ai:lovell'],
          pickNumber: 1,
          currentPacks: {
            'host-uid': [{ low: 0, high: 1 }],
            'ai:lovell': [{ low: 2, high: 3 }],
          },
          pickedTiles: { 'host-uid': [], 'ai:lovell': [] },
        },
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'PICK_FROM_PACK',
        playerId: 'host-uid',
        coordinate: { low: 0, high: 1 },
      })
    ).toBeNull();
  });

  it('lets the host proxy AI draft picks', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        phase: 'drafting',
        activePlayerId: 'ai:lovell',
        draftState: {
          currentDrafter: 'ai:lovell',
          draftOrder: ['host-uid', 'ai:lovell'],
          pickNumber: 1,
          currentPacks: {
            'host-uid': [{ low: 0, high: 1 }],
            'ai:lovell': [{ low: 2, high: 3 }],
          },
          pickedTiles: { 'host-uid': [], 'ai:lovell': [] },
        },
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'PICK_FROM_PACK',
        playerId: 'ai:lovell',
        coordinate: { low: 2, high: 3 },
      })
    ).toBeNull();
  });

  it('rejects PICK_FROM_PACK when the round is playing', () => {
    const doc = lobbyDoc();

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'PICK_FROM_PACK',
        playerId: 'host-uid',
        coordinate: { low: 0, high: 1 },
      })
    ).toBe('ROUND_NOT_DRAFTING');
  });

  it('rejects non-draft actions while drafting', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        phase: 'drafting',
        activePlayerId: 'host-uid',
        draftState: {
          currentDrafter: 'host-uid',
          draftOrder: ['host-uid', 'ai:lovell'],
          pickNumber: 1,
          currentPacks: {
            'host-uid': [{ low: 0, high: 1 }],
            'ai:lovell': [{ low: 2, high: 3 }],
          },
          pickedTiles: { 'host-uid': [], 'ai:lovell': [] },
        },
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'PASS_TURN',
        playerId: 'host-uid',
      })
    ).toBe('ROUND_NOT_PLAYING');
  });

  it('rejects a guest submitting for an AI captain', () => {
    const base = lobbyDoc();
    const doc = lobbyDoc({
      captainIds: ['host-uid', 'guest-uid', 'ai:lovell'],
      captains: [
        base.captains[0]!,
        {
          id: 'guest-uid',
          displayName: 'Kirk',
          pointsScore: 0,
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
        base.captains[1]!,
      ],
    });

    expect(
      assertActorMaySubmit(doc, 'guest-uid', {
        type: 'PASS_TURN',
        playerId: 'ai:lovell',
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
        playerId: 'ai:lovell',
      })
    ).toBe('NOT_YOUR_TURN');
  });

  it('lets the round winner call all stop while the round is still open', () => {
    const doc = lobbyDoc({
      captainIds: ['host-uid', 'guest-uid'],
      captains: [
        lobbyDoc().captains[0]!,
        {
          id: 'guest-uid',
          displayName: 'Janeway',
          pointsScore: 0,
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'guest-uid',
        roundWinnerId: 'guest-uid',
        allStopRequired: true,
        allStopDeclared: false,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'guest-uid', {
        type: 'ALL_STOP',
        playerId: 'guest-uid',
      })
    ).toBeNull();
  });

  it('allows call all stop when roundWinnerId was not persisted yet', () => {
    const doc = lobbyDoc({
      captainIds: ['host-uid', 'guest-uid'],
      captains: [
        lobbyDoc().captains[0]!,
        {
          id: 'guest-uid',
          displayName: 'Janeway',
          pointsScore: 0,
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'guest-uid',
        roundWinnerId: null,
        allStopRequired: true,
        allStopDeclared: false,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'guest-uid', {
        type: 'ALL_STOP',
        playerId: 'guest-uid',
      })
    ).toBeNull();
  });

  it('allows the host to proxy ALL_STOP for an AI round winner', () => {
    const doc = lobbyDoc({
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'ai:lovell',
        roundWinnerId: 'ai:lovell',
        allStopRequired: true,
        allStopDeclared: false,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'ALL_STOP',
        playerId: 'ai:lovell',
      })
    ).toBeNull();
  });

  it('allows an active captain to declare Drop to Impulse', () => {
    const doc = lobbyDoc({
      houseRules: { dropToImpulseCall: true },
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'host-uid',
        dropToImpulseCallPending: 'host-uid',
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'DROP_TO_IMPULSE',
        playerId: 'host-uid',
      })
    ).toBeNull();
  });

  it('allows off-turn catch of a missed Drop to Impulse', () => {
    const doc = lobbyDoc({
      houseRules: { dropToImpulseCall: true },
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'ai:lovell',
        dropToImpulseCatchable: 'host-uid',
      },
    });

    expect(
      assertActorMaySubmit(doc, 'ai:lovell', {
        type: 'CATCH_DROP_TO_IMPULSE',
        challengerId: 'ai:lovell',
        targetPlayerId: 'host-uid',
      })
    ).toBeNull();
  });

  it('rejects Drop to Impulse when the house rule is off', () => {
    const doc = lobbyDoc({
      houseRules: { dropToImpulseCall: false },
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'host-uid',
        dropToImpulseCallPending: 'host-uid',
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'DROP_TO_IMPULSE',
        playerId: 'host-uid',
      })
    ).toBe('DROP_TO_IMPULSE_NOT_REQUIRED');
  });

  it('allows RAISE_SHIELDS for the active captain', () => {
    const doc = lobbyDoc({
      houseRules: { manualShieldControl: true },
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'host-uid',
        playedThisTurn: true,
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'RAISE_SHIELDS',
        playerId: 'host-uid',
      })
    ).toBeNull();
  });

  it('rejects RAISE_SHIELDS for a non-active captain', () => {
    const doc = lobbyDoc({
      houseRules: { manualShieldControl: true },
      round: {
        ...lobbyDoc().round!,
        activePlayerId: 'ai:lovell',
      },
    });

    expect(
      assertActorMaySubmit(doc, 'host-uid', {
        type: 'RAISE_SHIELDS',
        playerId: 'host-uid',
      })
    ).toBe('NOT_YOUR_TURN');
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
