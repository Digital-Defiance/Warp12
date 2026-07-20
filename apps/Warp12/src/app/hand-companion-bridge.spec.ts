import { describe, expect, it } from 'vitest';

import { HAND_COMPANION_CHANNEL, handCompanionChannelForSeat } from './hand-companion-broadcast.js';
import {
  companionListenChannels,
  isCompanionHandoffEnabled,
  resolveCompanionHumanSeats,
  resolveFollowCompanionSeatId,
  shouldAcceptCompanionAction,
  shouldAcceptCompanionHandoffReady,
} from './hand-companion-bridge.js';

describe('hand-companion-bridge', () => {
  it('skips handoff only in couch mode', () => {
    expect(isCompanionHandoffEnabled(false)).toBe(true);
    expect(isCompanionHandoffEnabled(true)).toBe(false);
  });

  it('resolves pass-and-play human seats and solo vs AI', () => {
    expect(
      resolveCompanionHumanSeats({
        mode: 'local',
        isOnline: false,
        isVsAi: false,
        humanId: 'you',
        humanCaptains: [
          { id: 'human:0', displayName: 'Armstrong' },
          { id: 'human:1', displayName: 'Lovell' },
        ],
        names: {},
      })
    ).toEqual([
      { id: 'human:0', displayName: 'Armstrong' },
      { id: 'human:1', displayName: 'Lovell' },
    ]);

    expect(
      resolveCompanionHumanSeats({
        mode: 'local',
        isOnline: false,
        isVsAi: true,
        humanId: 'you',
        humanName: 'Pike',
        names: { you: 'Pike' },
      })
    ).toEqual([{ id: 'you', displayName: 'Pike' }]);

    expect(
      resolveCompanionHumanSeats({
        mode: 'online',
        isOnline: true,
        isVsAi: false,
        humanId: 'uid',
        names: {},
      })
    ).toEqual([]);
  });

  it('follows the active human seat for /local/hand', () => {
    const seats = [
      { id: 'human:0', displayName: 'A' },
      { id: 'human:1', displayName: 'B' },
    ];
    expect(
      resolveFollowCompanionSeatId({
        isLocalPassAndPlay: true,
        activePlayerId: 'human:1',
        humanSeatIds: new Set(['human:0', 'human:1']),
        companionSeats: seats,
        humanId: 'you',
      })
    ).toBe('human:1');

    expect(
      resolveFollowCompanionSeatId({
        isLocalPassAndPlay: true,
        activePlayerId: 'ai:chen',
        humanSeatIds: new Set(['human:0', 'human:1']),
        companionSeats: seats,
        humanId: 'you',
      })
    ).toBe('human:0');

    expect(
      resolveFollowCompanionSeatId({
        isLocalPassAndPlay: false,
        activePlayerId: 'ai:chen',
        humanSeatIds: new Set(['you']),
        companionSeats: [{ id: 'you', displayName: 'You' }],
        humanId: 'you',
      })
    ).toBe('you');
  });

  it('accepts actions only for the channel seat / follow owner', () => {
    const humanSeatIds = new Set(['human:0', 'human:1']);
    expect(
      shouldAcceptCompanionAction({
        channelName: HAND_COMPANION_CHANNEL,
        actorId: 'human:0',
        handOwnerId: 'human:0',
        humanSeatIds,
        humanId: 'you',
      })
    ).toBe(true);

    expect(
      shouldAcceptCompanionAction({
        channelName: HAND_COMPANION_CHANNEL,
        actorId: 'human:1',
        handOwnerId: 'human:0',
        humanSeatIds,
        humanId: 'you',
      })
    ).toBe(false);

    expect(
      shouldAcceptCompanionAction({
        channelName: handCompanionChannelForSeat('human:1'),
        actorId: 'human:1',
        handOwnerId: 'human:0',
        humanSeatIds,
        humanId: 'you',
      })
    ).toBe(true);

    expect(
      shouldAcceptCompanionAction({
        channelName: handCompanionChannelForSeat('human:1'),
        actorId: 'human:0',
        handOwnerId: 'human:0',
        humanSeatIds,
        humanId: 'you',
      })
    ).toBe(false);

    expect(
      shouldAcceptCompanionAction({
        channelName: handCompanionChannelForSeat('human:9'),
        actorId: 'human:9',
        handOwnerId: 'human:0',
        humanSeatIds,
        humanId: 'you',
      })
    ).toBe(false);
  });

  it('accepts handoff-ready for the active seat', () => {
    expect(
      shouldAcceptCompanionHandoffReady({
        channelName: handCompanionChannelForSeat('human:0'),
        readySeatId: 'human:0',
        activePlayerId: 'human:0',
        handOwnerId: 'human:0',
      })
    ).toBe(true);

    expect(
      shouldAcceptCompanionHandoffReady({
        channelName: handCompanionChannelForSeat('human:1'),
        readySeatId: 'human:1',
        activePlayerId: 'human:0',
        handOwnerId: 'human:0',
      })
    ).toBe(false);

    expect(
      shouldAcceptCompanionHandoffReady({
        channelName: HAND_COMPANION_CHANNEL,
        readySeatId: 'someone-else',
        activePlayerId: 'human:0',
        handOwnerId: 'human:0',
      })
    ).toBe(true);
  });

  it('lists base + per-seat listen channels', () => {
    expect(
      companionListenChannels([
        { id: 'human:0', displayName: 'A' },
        { id: 'human:1', displayName: 'B' },
      ])
    ).toEqual([
      HAND_COMPANION_CHANNEL,
      handCompanionChannelForSeat('human:0'),
      handCompanionChannelForSeat('human:1'),
    ]);
  });
});
