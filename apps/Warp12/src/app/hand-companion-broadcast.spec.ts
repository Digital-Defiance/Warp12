import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { GameState } from 'warp12-engine';

import {
  HAND_COMPANION_CHANNEL,
  handCompanionChannelForSeat,
  isHandCompanionInboundMessage,
  isHandCompanionOutboundMessage,
  localHandCompanionPath,
  publishHandCompanionAction,
  publishHandCompanionHandoffReady,
  publishHandCompanionRoster,
  publishHandCompanionSnapshot,
  redactGameForSeat,
} from './hand-companion-broadcast.js';

const emptyHelm = {
  showDraw: false,
  showDesperationDig: false,
  showShieldsDown: false,
  showShieldsUp: false,
  showPassRedAlert: false,
  showPass: false,
} as const;

describe('hand-companion-broadcast', () => {
  const posts: unknown[] = [];

  beforeEach(() => {
    posts.length = 0;
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        name: string;
        constructor(name: string) {
          this.name = name;
        }
        postMessage(data: unknown) {
          posts.push({ channel: this.name, data });
        }
        close() {
          // no-op
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('type-guards outbound and inbound messages', () => {
    expect(isHandCompanionOutboundMessage({ type: 'hello' })).toBe(true);
    expect(isHandCompanionOutboundMessage({ type: 'roster' })).toBe(true);
    expect(isHandCompanionInboundMessage({ type: 'handoff-ready' })).toBe(true);
    expect(
      isHandCompanionInboundMessage({
        type: 'action',
        action: { type: 'PASS_TURN', playerId: 'p1' },
      })
    ).toBe(true);
    expect(isHandCompanionOutboundMessage({ type: 'action' })).toBe(false);
  });

  it('publishes snapshots, actions, handoff-ready, and roster', () => {
    publishHandCompanionSnapshot({
      gameId: 'local-1',
      maxPip: 12,
      handOwnerId: 'human:0',
      handOwnerName: 'Captain',
      isMyTurn: true,
      phase: 'active',
      status: 'Your turn',
      hand: [{ low: 0, high: 0 }],
      legalMoves: [],
      helm: emptyHelm,
      spoolOptions: [],
      dropToImpulsePending: false,
      canCatchDropToImpulse: false,
      dropToImpulseCatchTargetId: null,
      dropToImpulseCatchLabel: null,
      names: { 'human:0': 'Captain' },
      game: null,
      tileBg: 'dark',
      handoffPending: false,
      handoffCaptainName: null,
    });
    publishHandCompanionAction(
      {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'human:0',
      },
      handCompanionChannelForSeat('human:0')
    );
    publishHandCompanionHandoffReady('human:0');
    publishHandCompanionRoster({
      gameId: 'local-1',
      seats: [{ id: 'human:0', displayName: 'Ada' }],
    });
    expect(posts).toHaveLength(4);
    expect(posts[0]).toMatchObject({
      channel: HAND_COMPANION_CHANNEL,
      data: { type: 'snapshot', gameId: 'local-1' },
    });
    expect(posts[1]).toMatchObject({
      channel: handCompanionChannelForSeat('human:0'),
      data: { type: 'action' },
    });
    expect(posts[2]).toMatchObject({
      channel: handCompanionChannelForSeat('human:0'),
      data: { type: 'handoff-ready', seatId: 'human:0' },
    });
    expect(posts[3]).toMatchObject({
      data: { type: 'roster', seats: [{ id: 'human:0' }] },
    });
  });

  it('builds seat paths and channel names', () => {
    expect(localHandCompanionPath()).toBe('/local/hand');
    expect(localHandCompanionPath('human:1')).toBe('/local/hand/human%3A1');
    expect(handCompanionChannelForSeat('human:1')).toBe(
      `${HAND_COMPANION_CHANNEL}:human:1`
    );
  });

  it('redacts other captains hands and draft packs', () => {
    const game = {
      round: {
        hands: {
          'human:0': [{ low: 1, high: 2 }],
          'human:1': [{ low: 3, high: 4 }],
        },
        draftState: {
          draftOrder: ['human:0', 'human:1'],
          currentDrafter: 'human:0',
          currentPacks: {
            'human:0': [{ low: 5, high: 5 }],
            'human:1': [{ low: 6, high: 6 }],
          },
          pickedTiles: {
            'human:0': [{ low: 0, high: 0 }],
            'human:1': [{ low: 7, high: 7 }],
          },
        },
      },
    } as unknown as GameState;

    const redacted = redactGameForSeat(game, 'human:0');
    expect(redacted.round?.hands['human:0']).toEqual([{ low: 1, high: 2 }]);
    expect(redacted.round?.hands['human:1']).toEqual([]);
    expect(redacted.round?.draftState?.currentPacks['human:0']).toEqual([
      { low: 5, high: 5 },
    ]);
    expect(redacted.round?.draftState?.currentPacks['human:1']).toEqual([]);
    expect(redacted.round?.draftState?.pickedTiles['human:1']).toEqual([]);
  });
});
