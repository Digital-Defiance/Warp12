import {
  applyAction,
  scoreRound,
  type GameAction,
  type GameState,
  type WarpAiPlayer,
} from 'warp12-engine';
import type { ActionLogEntry } from 'warp12-react';

import {
  buildAiRoster,
  createLocalGame,
} from './create-local-game.js';
import type { LocalGameConfig } from './local-game-config.js';
import { humanWonLocalMatch } from './local-match-stats.js';

export interface LocalAiReplayPayload {
  config: LocalGameConfig;
  seed: number;
  actionLog: readonly Pick<ActionLogEntry, 'action' | 'ok' | 'source'>[];
}

export interface LocalAiHumanReplayPayload {
  config: LocalGameConfig;
  seed: number;
  /** Human captain moves only, in chronological order. */
  humanActions: readonly GameAction[];
}

export type LocalAiReplayResult =
  | {
      ok: true;
      finalState: GameState;
      humanWon: boolean;
      steps: number;
    }
  | {
      ok: false;
      violation: string;
      steps: number;
      partialState?: GameState;
    };

const MAX_REPLAY_STEPS = 50_000;

/** Same stream self-play uses so inter-round shuffles are reproducible. */
export function createMatchRoundReshuffle(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Apply actions with deterministic round recycling (END_ROUND → scoreRound). */
export function applyMatchAction(
  state: GameState,
  action: GameAction,
  roundReshuffle: () => number
): ReturnType<typeof applyAction> {
  if (action.type !== 'END_ROUND') {
    return applyAction(state, action);
  }

  if (state.phase !== 'active' || !state.round) {
    return { ok: false, violation: 'GAME_NOT_ACTIVE' };
  }

  const round = state.round;
  if (round.phase !== 'ended') {
    return { ok: false, violation: 'ROUND_NOT_PLAYING' };
  }

  if (round.roundBlocked) {
    if (action.winnerId !== null) {
      return { ok: false, violation: 'ROUND_NOT_PLAYING' };
    }
    return scoreRound(state, round, roundReshuffle);
  }

  if (round.roundWinnerId !== action.winnerId) {
    return { ok: false, violation: 'ROUND_NOT_PLAYING' };
  }

  return scoreRound(state, round, roundReshuffle);
}

/** Replay a recorded local vs-AI match from seed + action log (investigation / verification). */
export function replayLocalAiActionLog(
  payload: LocalAiReplayPayload
): LocalAiReplayResult {
  let state = createLocalGame(payload.config, payload.seed);
  const roundReshuffle = createMatchRoundReshuffle(payload.seed);
  let steps = 0;

  for (const entry of payload.actionLog) {
    if (steps >= MAX_REPLAY_STEPS) {
      return {
        ok: false,
        violation: 'REPLAY_STEP_LIMIT',
        steps,
        partialState: state,
      };
    }
    if (entry.ok === false) {
      continue;
    }
    const result = applyMatchAction(state, entry.action, roundReshuffle);
    steps += 1;
    if (!result.ok) {
      return {
        ok: false,
        violation: result.violation,
        steps,
        partialState: state,
      };
    }
    state = result.state;
  }

  return {
    ok: true,
    finalState: state,
    humanWon: humanWonLocalMatch(state, payload.config.humanId),
    steps,
  };
}

function roundAwaitingScore(state: GameState): boolean {
  const round = state.round;
  return (
    state.phase === 'active' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked)
  );
}

async function pickAiAction(
  ai: WarpAiPlayer,
  state: GameState,
  playerId: string
): Promise<GameAction | null> {
  const scratch = structuredClone(state);
  const offTurn = ai.decideOffTurnGameAction
    ? ai.decideOffTurnGameAction(scratch, playerId)
    : null;
  if (offTurn) {
    return offTurn;
  }
  if (scratch.round?.phase !== 'playing' || scratch.round.activePlayerId !== playerId) {
    return null;
  }
  return ai.decideGameAction(structuredClone(state), playerId);
}

/**
 * Server-style replay: run AI on-device, accept only human moves from the client.
 * Used to derive match outcome without trusting `won`.
 */
export async function replayLocalAiHumanActions(
  payload: LocalAiHumanReplayPayload
): Promise<LocalAiReplayResult> {
  const humanActions = payload.humanActions.filter(
    (action) => action.type !== 'END_ROUND'
  );
  if (humanActions.length === 0) {
    return { ok: false, violation: 'NO_HUMAN_ACTIONS', steps: 0 };
  }

  let state = createLocalGame(payload.config, payload.seed);
  const roster = buildAiRoster(payload.config, payload.seed);
  const roundReshuffle = createMatchRoundReshuffle(payload.seed);
  const humanQueue = [...humanActions];
  let steps = 0;

  while (state.phase !== 'complete' && steps < MAX_REPLAY_STEPS) {
    if (roundAwaitingScore(state)) {
      const round = state.round!;
      const action: GameAction = {
        type: 'END_ROUND',
        winnerId: round.roundBlocked ? null : round.roundWinnerId!,
      };
      const result = applyMatchAction(state, action, roundReshuffle);
      steps += 1;
      if (!result.ok) {
        return { ok: false, violation: result.violation, steps, partialState: state };
      }
      state = result.state;
      continue;
    }

    const round = state.round;
    if (!round || round.phase !== 'playing') {
      return {
        ok: false,
        violation: 'STALE_GAME_STATE',
        steps,
        partialState: state,
      };
    }

    const activeId = round.activePlayerId;

    if (activeId === payload.config.humanId) {
      const next = humanQueue.shift();
      if (!next) {
        return {
          ok: false,
          violation: 'HUMAN_ACTIONS_EXHAUSTED',
          steps,
          partialState: state,
        };
      }
      const result = applyMatchAction(state, next, roundReshuffle);
      steps += 1;
      if (!result.ok) {
        return { ok: false, violation: result.violation, steps, partialState: state };
      }
      state = result.state;
      continue;
    }

    const ai = roster.get(activeId);
    if (!ai) {
      return {
        ok: false,
        violation: 'UNKNOWN_ACTIVE_PLAYER',
        steps,
        partialState: state,
      };
    }

    const action = await pickAiAction(ai, state, activeId);
    if (!action) {
      return {
        ok: false,
        violation: 'AI_NO_ACTION',
        steps,
        partialState: state,
      };
    }
    const result = applyMatchAction(state, action, roundReshuffle);
    steps += 1;
    if (!result.ok) {
      return { ok: false, violation: result.violation, steps, partialState: state };
    }
    state = result.state;
  }

  if (state.phase !== 'complete') {
    return {
      ok: false,
      violation: 'MATCH_INCOMPLETE',
      steps,
      partialState: state,
    };
  }

  if (humanQueue.length > 0) {
    return {
      ok: false,
      violation: 'EXTRA_HUMAN_ACTIONS',
      steps,
      partialState: state,
    };
  }

  return {
    ok: true,
    finalState: state,
    humanWon: humanWonLocalMatch(state, payload.config.humanId),
    steps,
  };
}

export function extractHumanActions(
  config: LocalGameConfig,
  actionLog: readonly ActionLogEntry[]
): GameAction[] {
  return actionLog
    .filter(
      (entry) =>
        entry.ok !== false &&
        entry.source === 'human' &&
        entry.playerId === config.humanId &&
        // Server replay scores ended rounds itself; including END_ROUND breaks verification.
        entry.action.type !== 'END_ROUND'
    )
    .map((entry) => entry.action);
}
