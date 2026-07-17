import { describe, expect, it } from 'vitest';

import type { FirestoreGameDocument } from './schema.js';
import {
  isRoundAwaitingScore,
  remoteHandCaptainIdsForViewer,
  remoteHandIdsNeedingHydration,
  shouldResubscribeRemoteHands,
} from './remote-hands.js';

function doc(
  over: Partial<FirestoreGameDocument> & {
    round?: Partial<NonNullable<FirestoreGameDocument['round']>> | null;
  }
): FirestoreGameDocument {
  const { round: roundOver, ...rest } = over;
  const baseRound =
    roundOver === null
      ? null
      : {
          roundNumber: 1,
          spacedockValue: 12,
          phase: 'playing' as const,
          activePlayerId: 'host',
          turnOrder: ['host', 'ai:chen'],
          handCounts: { host: 5, 'ai:chen': 5 },
          unchartedSectors: [],
          allStopRequired: false,
          allStopDeclared: false,
          roundWinnerId: null,
          roundBlocked: false,
          table: {
            spacedock: { value: 12, placedBy: 'host' },
            warpTrails: [],
            neutralZone: { tiles: [] },
            subspaceFracture: null,
            redAlert: null,
          },
          ...(roundOver ?? {}),
        };
  return {
    id: '5K7E8C',
    hostId: 'host',
    phase: 'active',
    createdAt: 't0',
    updatedAt: 't1',
    captains: [
      { id: 'host', displayName: 'Picard', pointsScore: 0, joinedAt: 't0' },
      {
        id: 'ai:chen',
        displayName: 'Chen',
        pointsScore: 0,
        joinedAt: 't0',
        isAi: true,
      },
    ],
    captainIds: ['host', 'ai:chen'],
    objective: 'points',
    campaignRounds: 13,
    completedRounds: 0,
    maxPip: 12,
    maxPlayers: 8,
    rated: true,
    modules: {},
    houseRules: {
      requireOwnTrailFirst: false,
      neutralZoneAfterAllTrails: false,
      beaconClearsOnAnyPlay: false,
      roundStarterPlaysTwo: false,
      dropToImpulseCall: false,
      dropToImpulseCatchPenalty: 1,
      allStopCeremony: false,
      passRedAlertWithoutDraw: false,
      manualShieldControl: false,
      doubleZeroScore: 0,
      largeFleetHandSize: false,
    },
    flash: null,
    round: baseRound,
    ...rest,
  } as FirestoreGameDocument;
}

describe('remoteHandCaptainIdsForViewer', () => {
  it('host always mirrors every other seat while a round exists', () => {
    expect(
      remoteHandCaptainIdsForViewer(doc({}), 'host', 'play')
    ).toEqual(['ai:chen']);
  });

  it('non-host only mirrors seats once the round is awaiting score', () => {
    expect(
      remoteHandCaptainIdsForViewer(doc({}), 'guest', 'play')
    ).toEqual([]);
    expect(
      remoteHandCaptainIdsForViewer(
        doc({
          captainIds: ['host', 'guest', 'ai:chen'],
          round: { phase: 'ended', roundWinnerId: 'guest' },
        }),
        'guest',
        'play'
      )
    ).toEqual(['host', 'ai:chen']);
  });
});

describe('shouldResubscribeRemoteHands', () => {
  it('resubscribes when the mirrored seat list changes', () => {
    const prev = doc({});
    const next = doc({
      captains: [
        ...doc({}).captains,
        {
          id: 'ai:smith',
          displayName: 'Smith',
          pointsScore: 0,
          joinedAt: 't0',
          isAi: true,
        },
      ],
      captainIds: ['host', 'ai:chen', 'ai:smith'],
      round: {
        turnOrder: ['host', 'ai:chen', 'ai:smith'],
        handCounts: { host: 4, 'ai:chen': 4, 'ai:smith': 4 },
      },
    });
    expect(shouldResubscribeRemoteHands(prev, next, 'host', 'play')).toBe(true);
  });

  it('forces host resubscribe when a round ends even if seats are unchanged', () => {
    const prev = doc({});
    const next = doc({
      round: { phase: 'ended', roundWinnerId: 'ai:chen', handCounts: { host: 3, 'ai:chen': 0 } },
    });
    expect(isRoundAwaitingScore(prev)).toBe(false);
    expect(isRoundAwaitingScore(next)).toBe(true);
    expect(
      remoteHandCaptainIdsForViewer(prev, 'host', 'play')
    ).toEqual(remoteHandCaptainIdsForViewer(next, 'host', 'play'));
    expect(shouldResubscribeRemoteHands(prev, next, 'host', 'play')).toBe(true);
  });

  it('does not resubscribe on ordinary mid-round public updates for the host', () => {
    const prev = doc({});
    const next = doc({
      round: { activePlayerId: 'ai:chen', handCounts: { host: 4, 'ai:chen': 5 } },
    });
    expect(shouldResubscribeRemoteHands(prev, next, 'host', 'play')).toBe(false);
  });
});

describe('remoteHandIdsNeedingHydration', () => {
  it('flags seats with public counts but empty mirrors', () => {
    expect(
      remoteHandIdsNeedingHydration(
        { host: 3, 'ai:chen': 2, 'ai:smith': 2, 'ai:nguyen': 0 },
        { host: [{ low: 1, high: 2 }], 'ai:chen': [], 'ai:nguyen': [] },
        ['host', 'ai:chen', 'ai:smith', 'ai:nguyen']
      )
    ).toEqual(['ai:chen', 'ai:smith']);
  });
});
