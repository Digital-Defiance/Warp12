import {
  createWarpAiPlayer,
  getLegalMoves,
  getWarpSkillProfile,
  observe,
  toGameAction,
  type GameAction,
  type GameState,
  type PlayerId,
} from 'warp12-engine';
import {
  getCoachSuggestion,
  type CoachSuggestionOptions,
} from 'warp12-react';

export type ConsolePlayMode = 'random' | 'advisor';

export interface SuggestConsoleHumanActionOptions extends CoachSuggestionOptions {
  readonly names?: Readonly<Record<string, string>>;
}

/**
 * Pick the next human action for console autoplay.
 * - `advisor`: tactical coach (concept net / Ω / heuristic ladder).
 * - `random`: uniform pick among legal charts; ensign AI for draw/pass/etc.
 */
export function suggestConsoleHumanAction(
  state: GameState,
  playerId: PlayerId,
  mode: ConsolePlayMode,
  options: SuggestConsoleHumanActionOptions = {}
): GameAction | null {
  const round = state.round;
  if (!round || round.phase !== 'playing' || round.activePlayerId !== playerId) {
    return null;
  }

  if (mode === 'advisor') {
    const { names, ...coachOptions } = options;
    const suggestion = getCoachSuggestion(
      state,
      playerId,
      names ?? {},
      coachOptions
    );
    return suggestion?.gameAction ?? null;
  }

  if (round.allStopRequired && !round.allStopDeclared) {
    return { type: 'ALL_STOP', playerId };
  }

  if (round.dropToImpulseCallPending === playerId) {
    return { type: 'DROP_TO_IMPULSE', playerId };
  }

  const moves = getLegalMoves(round, playerId, state.houseRules);
  if (moves.length > 0) {
    const move = moves[Math.floor(Math.random() * moves.length)]!;
    return {
      type: 'CHART_COORDINATE',
      playerId,
      coordinate: move.coordinate,
      route: move.route,
    };
  }

  const observation = observe(state, playerId);
  if (!observation) {
    return null;
  }

  const action = createWarpAiPlayer({
    skill: getWarpSkillProfile(
      'ensign',
      state.objective,
      observation.captains.length
    ),
    objective: state.objective,
  }).decide(observation);

  return toGameAction(action, playerId);
}
