import {
  observe,
  toGameAction,
  type GameAction,
  type GameState,
  warpCandidateGenerator,
  warpOffTurnCandidateGenerator,
} from 'warp12-engine';
import type { ActionLogEntry } from 'warp12-react';
import { playerIdForAction } from 'warp12-react';

import {
  buildAiRoster,
  createLocalGame,
} from './create-local-game.js';
import { defaultLocalGameConfig } from './local-game-config.js';
import type { LocalGameConfig } from './local-game-config.js';
import {
  applyMatchAction,
  createMatchRoundReshuffle,
} from './verify-local-ai-replay.js';

const MAX_SIM_STEPS = 50_000;

function roundAwaitingScore(state: GameState): boolean {
  const round = state.round;
  return (
    state.phase === 'active' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked)
  );
}

function pickHumanMove(state: GameState, humanId: string): GameAction | null {
  const obs = observe(structuredClone(state), humanId);
  if (!obs || obs.round.phase !== 'playing') {
    return null;
  }

  const onTurn = obs.round.activePlayerId === humanId;
  const candidates = onTurn
    ? warpCandidateGenerator(obs)
    : warpOffTurnCandidateGenerator(obs);
  const first = candidates[0];
  return first ? toGameAction(first, humanId) : null;
}

/**
 * Headless local vs-AI simulation for replay verification tests.
 * Human takes the first legal move each turn; AI uses the same roster as production.
 */
export async function simulateLocalAiMatch(input?: {
  config?: LocalGameConfig;
  seed?: number;
  /**
   * Test-only: seed the inter-round reshuffle stream independently of the deal
   * seed. Defaults to `seed` (production behavior). Used to model a live game
   * that reshuffled with a non-matching stream — which must FAIL verification.
   */
  reshuffleSeed?: number;
}): Promise<{
  config: LocalGameConfig;
  seed: number;
  actionLog: ActionLogEntry[];
  finalState: GameState;
}> {
  const config = input?.config ?? defaultLocalGameConfig('Test Captain', 4);
  const seed = input?.seed ?? 42_424_242;
  let state = createLocalGame(config, seed);
  const roundReshuffle = createMatchRoundReshuffle(input?.reshuffleSeed ?? seed);
  const roster = buildAiRoster(config, seed);
  const actionLog: ActionLogEntry[] = [];
  let steps = 0;

  const record = (
    action: GameAction,
    ok: boolean,
    source: ActionLogEntry['source'],
    violation?: string
  ) => {
    actionLog.push({
      at: new Date().toISOString(),
      playerId: playerIdForAction(action),
      action,
      ok,
      violation,
      source,
    });
  };

  while (state.phase !== 'complete' && steps < MAX_SIM_STEPS) {
    if (roundAwaitingScore(state)) {
      const round = state.round!;
      const action: GameAction = {
        type: 'END_ROUND',
        winnerId: round.roundBlocked ? null : round.roundWinnerId!,
      };
      const result = applyMatchAction(state, action, roundReshuffle);
      record(action, result.ok, 'auto', result.ok ? undefined : result.violation);
      steps += 1;
      if (!result.ok) {
        break;
      }
      state = result.state;
      continue;
    }

    const round = state.round;
    if (!round || round.phase !== 'playing') {
      break;
    }

    const activeId = round.activePlayerId;
    let action: GameAction | null = null;
    let source: ActionLogEntry['source'] = 'human';

    if (activeId === config.humanId) {
      action = pickHumanMove(state, config.humanId);
    } else {
      source = 'ai';
      const ai = roster.get(activeId);
      action = ai
        ? ai.decideGameAction(structuredClone(state), activeId)
        : null;
    }

    if (!action) {
      break;
    }

    const result = applyMatchAction(state, action, roundReshuffle);
    record(action, result.ok, source, result.ok ? undefined : result.violation);
    steps += 1;
    if (!result.ok) {
      break;
    }
    state = result.state;
  }

  return { config, seed, actionLog, finalState: state };
}
