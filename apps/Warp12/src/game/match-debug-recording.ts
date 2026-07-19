/**
 * Session-scoped full-match debug recording for AI-digestible exports.
 * Reset whenever a new Round 1 begins.
 */

import type { GameAction, GameState } from 'warp12-engine';

import type { ActionLogEntry } from 'warp12-react';

export interface MatchDebugRoundSnapshot {
  readonly roundNumber: number;
  readonly at: string;
  readonly kind: 'round-start' | 'round-end';
  readonly gameState: GameState;
}

export interface MatchDebugRecording {
  readonly enabled: boolean;
  readonly startedAt: string | null;
  readonly rounds: readonly MatchDebugRoundSnapshot[];
  readonly actionLog: readonly ActionLogEntry[];
}

export function createEmptyMatchDebugRecording(
  enabled = false
): MatchDebugRecording {
  return {
    enabled,
    startedAt: null,
    rounds: [],
    actionLog: [],
  };
}

export function shouldResetMatchDebugOnRound(
  previousRound: number | null,
  nextRound: number
): boolean {
  // New match / rematch always starts at round 1.
  return nextRound === 1 && previousRound !== 1;
}

export function appendMatchDebugAction(
  recording: MatchDebugRecording,
  entry: ActionLogEntry
): MatchDebugRecording {
  if (!recording.enabled) {
    return recording;
  }
  return {
    ...recording,
    startedAt: recording.startedAt ?? entry.at,
    actionLog: [...recording.actionLog, entry],
  };
}

export function appendMatchDebugRoundSnapshot(
  recording: MatchDebugRecording,
  snapshot: MatchDebugRoundSnapshot
): MatchDebugRecording {
  if (!recording.enabled) {
    return recording;
  }
  return {
    ...recording,
    startedAt: recording.startedAt ?? snapshot.at,
    rounds: [...recording.rounds, snapshot],
  };
}

/**
 * Round-end snapshots must capture the pre-`END_ROUND` / pre-redeal state
 * (ended hands + table + winner). Post-score state is already the next deal.
 */
export function isUsableRoundEndSnapshot(
  snapshot: Pick<MatchDebugRoundSnapshot, 'kind' | 'gameState'>
): boolean {
  if (snapshot.kind !== 'round-end') {
    return true;
  }
  const round = snapshot.gameState.round;
  if (!round) {
    return false;
  }
  // Healthy end: round still marked ended (or match complete) with a winner /
  // block resolution — not a freshly dealt "playing" hand.
  if (round.phase === 'ended' || snapshot.gameState.phase === 'complete') {
    return true;
  }
  return false;
}

export function enableMatchDebugRecording(
  _previous: MatchDebugRecording
): MatchDebugRecording {
  return {
    ...createEmptyMatchDebugRecording(true),
    startedAt: new Date().toISOString(),
  };
}

export function disableMatchDebugRecording(): MatchDebugRecording {
  return createEmptyMatchDebugRecording(false);
}

/** Strip huge nested noise while keeping replay-useful fields. */
export function matchDebugExportPayload(
  recording: MatchDebugRecording,
  meta: {
    exportedAt: string;
    mode: 'local' | 'online';
    sectorCode: string;
    viewerId: string;
  }
): Record<string, unknown> {
  return {
    format: 'warp12-match-debug-v1',
    ...meta,
    recording: {
      enabled: recording.enabled,
      startedAt: recording.startedAt,
      roundSnapshotCount: recording.rounds.length,
      actionCount: recording.actionLog.length,
      rounds: recording.rounds.map((round) => ({
        roundNumber: round.roundNumber,
        at: round.at,
        kind: round.kind,
        phase: round.gameState.phase,
        objective: round.gameState.objective,
        maxPip: round.gameState.maxPip,
        modules: round.gameState.modules,
        captains: round.gameState.captains,
        round: round.gameState.round,
      })),
      actionLog: recording.actionLog,
    },
  };
}

export function summarizeActionTypes(
  actions: readonly { action?: GameAction; type?: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of actions) {
    const type =
      entry.action && typeof entry.action === 'object' && 'type' in entry.action
        ? String(entry.action.type)
        : typeof entry.type === 'string'
          ? entry.type
          : 'unknown';
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}
