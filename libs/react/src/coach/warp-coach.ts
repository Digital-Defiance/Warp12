import {
  createWarpAiPlayer,
  explainTurnResolution,
  explainWarpAiAction,
  getAdvisorSkillProfile,
  observe,
  resolveAdvisorLookahead,
  toGameAction,
  type ChartRoute,
  type GameAction,
  type GameState,
  type PlayerId,
  type WarpAiAction,
} from 'warp12-engine';

import { routeLabel } from '../adapters/game-to-trains.js';

export interface CoachSuggestion {
  readonly action: WarpAiAction;
  readonly gameAction: GameAction;
  readonly reasons: readonly string[];
}

export function getCoachSuggestion(
  state: GameState,
  playerId: PlayerId,
  names: Readonly<Record<string, string>> = {}
): CoachSuggestion | null {
  const observation = observe(state, playerId);
  if (!observation) {
    return null;
  }

  const playerCount = observation.captains.length;
  const coach = createWarpAiPlayer({
    skill: getAdvisorSkillProfile(state.objective, playerCount),
    objective: state.objective,
    lookahead: resolveAdvisorLookahead(),
  });

  const action = coach.decide(observation);
  const reasons = mergeCoachReasons(
    explainWarpAiAction(state, playerId, action, { names }),
    explainTurnResolution(state, playerId, { names, focus: action.kind })
  );
  return {
    action,
    gameAction: toGameAction(action, playerId),
    reasons,
  };
}

function mergeCoachReasons(
  primary: readonly string[],
  supplemental: readonly string[]
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const line of [...primary, ...supplemental]) {
    if (seen.has(line)) {
      continue;
    }
    seen.add(line);
    merged.push(line);
    if (merged.length >= 4) {
      break;
    }
  }
  return merged;
}

export interface CoachSuggestionFormatOptions {
  readonly allStopEcho?: boolean;
}

export function formatCoachSuggestion(
  action: WarpAiAction,
  names: Readonly<Record<string, string>>,
  options?: CoachSuggestionFormatOptions
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
    case 'all-stop':
      return options?.allStopEcho
        ? 'All Stop! · round win pending'
        : 'All Stop! · Neutral Zone win';
    case 'return-to-warp':
      return 'Return to warp · penalty draw instead of All Stop!';
    case 'drop-to-impulse':
      return 'Drop to Impulse! · one coordinate left';
    case 'catch-drop-to-impulse': {
      const target = names[action.targetPlayerId] ?? action.targetPlayerId;
      return `Catch Drop to Impulse · ${target}`;
    }
    case 'invoke-q-flash':
      return `Invoke Q-Flash · ${action.effect.replaceAll('-', ' ')}`;
    case 'resolve-q-gamble':
      return `Keep gamble tile ${action.keepIndex + 1}`;
  }
}

export function coachChartMove(action: WarpAiAction): {
  coordinate: import('warp12-engine').Coordinate;
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
