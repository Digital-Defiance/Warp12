import {
  createWarpAiPlayer,
  getWarpSkillProfile,
  observe,
  toGameAction,
  type ChartRoute,
  type GameAction,
  type GameState,
  type PlayerId,
  type WarpAiAction,
} from '@warp12/Warp12-lib';

import { routeLabel } from './game-to-trains.js';

export interface CoachSuggestion {
  readonly action: WarpAiAction;
  readonly gameAction: GameAction;
}

export function getCoachSuggestion(
  state: GameState,
  playerId: PlayerId
): CoachSuggestion | null {
  const observation = observe(state, playerId);
  if (!observation) {
    return null;
  }

  const coach = createWarpAiPlayer({
    skill: getWarpSkillProfile('advanced', state.objective),
    objective: state.objective,
    lookahead: { depth: 2, determinizations: 6, maxBranch: 6 },
  });

  const action = coach.decide(observation);
  return {
    action,
    gameAction: toGameAction(action, playerId),
  };
}

export function formatCoachSuggestion(
  action: WarpAiAction,
  names: Readonly<Record<string, string>>
): string {
  switch (action.kind) {
    case 'chart': {
      const { low, high } = action.move.coordinate;
      return `Chart ${low}-${high} · ${routeLabel(action.move.route, names)}`;
    }
    case 'draw':
      return 'Draw from Uncharted Sectors';
    case 'deploy-beacon':
      return 'Deploy Distress Beacon (shields down)';
    case 'pass-red-alert':
      return 'Pass Red Alert to the next captain';
    case 'pass-turn':
      return 'Pass turn (voluntary shields down)';
    case 'declare-treaty':
      return 'Declare Neutral Zone Treaty';
    case 'invoke-q-flash':
      return `Invoke Q-Flash · ${action.effect.replaceAll('-', ' ')}`;
    case 'resolve-q-gamble':
      return `Keep gamble tile ${action.keepIndex + 1}`;
  }
}

export function coachChartMove(action: WarpAiAction): {
  coordinate: import('@warp12/Warp12-lib').Coordinate;
  route: ChartRoute;
} | null {
  if (action.kind !== 'chart') {
    return null;
  }
  return action.move;
}

export function coachActionKind(action: WarpAiAction): WarpAiAction['kind'] {
  return action.kind;
}
