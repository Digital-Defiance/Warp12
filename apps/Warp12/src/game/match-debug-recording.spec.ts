import { describe, expect, it } from 'vitest';

import {
  appendMatchDebugAction,
  createEmptyMatchDebugRecording,
  enableMatchDebugRecording,
  isUsableRoundEndSnapshot,
  shouldResetMatchDebugOnRound,
} from './match-debug-recording.js';

describe('match-debug-recording', () => {
  it('resets when entering a new Round 1 from another round', () => {
    expect(shouldResetMatchDebugOnRound(3, 1)).toBe(true);
    expect(shouldResetMatchDebugOnRound(null, 1)).toBe(true);
    expect(shouldResetMatchDebugOnRound(1, 1)).toBe(false);
    expect(shouldResetMatchDebugOnRound(1, 2)).toBe(false);
  });

  it('only appends actions while enabled', () => {
    const off = createEmptyMatchDebugRecording(false);
    const stillOff = appendMatchDebugAction(off, {
      at: '2026-01-01T00:00:00.000Z',
      playerId: 'you',
      action: { type: 'PASS', playerId: 'you' } as never,
      ok: true,
      source: 'human',
    });
    expect(stillOff.actionLog).toHaveLength(0);

    const on = enableMatchDebugRecording(off);
    const next = appendMatchDebugAction(on, {
      at: '2026-01-01T00:00:00.000Z',
      playerId: 'you',
      action: { type: 'PASS', playerId: 'you' } as never,
      ok: true,
      source: 'human',
    });
    expect(next.enabled).toBe(true);
    expect(next.actionLog).toHaveLength(1);
  });

  it('flags post-redeal round-end snapshots as unusable', () => {
    expect(
      isUsableRoundEndSnapshot({
        kind: 'round-end',
        gameState: {
          phase: 'active',
          round: { phase: 'playing', roundNumber: 2 },
        } as never,
      })
    ).toBe(false);

    expect(
      isUsableRoundEndSnapshot({
        kind: 'round-end',
        gameState: {
          phase: 'active',
          round: {
            phase: 'ended',
            roundNumber: 1,
            roundWinnerId: 'hassan',
          },
        } as never,
      })
    ).toBe(true);
  });
});
