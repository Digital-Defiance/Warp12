import { scoreWithHeuristics } from 'doubletwelve';

import {
  coordinateKey,
  coordinateMatchesValue,
  coordinatePipValue,
  isDouble,
  openValueAfterConnection,
  type Coordinate,
} from '../types/coordinate.js';
import type { GameState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import type { WarpAiAction } from './actions.js';
import {
  buildWarpContext,
  connectingValueForRoute,
  type WarpEvalContext,
} from './context.js';
import {
  DEFAULT_WARP_HEURISTICS,
  WARP_HEURISTIC_IDS,
} from './heuristics.js';
import { observe } from './observation.js';
import { getWarpSkillProfile } from './skill.js';
import { explainTurnResolution } from './explain-turn-resolution.js';

const H = WARP_HEURISTIC_IDS;

function followUpCount(
  action: Extract<WarpAiAction, { kind: 'chart' }>,
  ctx: WarpEvalContext
): { endValue: number; matches: number } | null {
  const connecting = connectingValueForRoute(ctx.obs.round, action.move.route);
  if (connecting === null) {
    return null;
  }
  const endValue = openValueAfterConnection(action.move.coordinate, connecting);
  if (endValue === null) {
    return null;
  }
  const tileKey = coordinateKey(action.move.coordinate);
  let skipped = false;
  let matches = 0;
  for (const coordinate of ctx.hand) {
    if (!skipped && coordinateKey(coordinate) === tileKey) {
      skipped = true;
      continue;
    }
    if (coordinateMatchesValue(coordinate, endValue)) {
      matches++;
    }
  }
  return { endValue, matches };
}

function unseenMatching(endValue: number, unseen: readonly Coordinate[]): number {
  let count = 0;
  for (const coordinate of unseen) {
    if (coordinateMatchesValue(coordinate, endValue)) {
      count++;
    }
  }
  return count;
}

function describeHeuristicContribution(
  id: string,
  action: WarpAiAction,
  ctx: WarpEvalContext,
  rawScore: number
): string | null {
  if (rawScore === 0) {
    return null;
  }

  switch (id) {
    case H.dumpPips: {
      if (action.kind !== 'chart' || ctx.obs.objective === 'go-out') {
        return null;
      }
      const pips = coordinatePipValue(action.move.coordinate);
      if (pips >= 10) {
        return `Sheds ${pips} pip points — a heavy tile off your hand.`;
      }
      if (pips >= 5) {
        return `Removes ${pips} pip points from your hand.`;
      }
      return null;
    }
    case H.goOutWin:
      if (action.kind === 'chart' && ctx.hand.length === 1) {
        return 'Empties your hand — you win the round.';
      }
      return null;
    case H.doublesEarly:
      if (action.kind === 'chart' && isDouble(action.move.coordinate)) {
        return 'Clears a double while your hand is still large.';
      }
      return null;
    case H.ownTrail: {
      if (action.kind !== 'chart') {
        return null;
      }
      const route = action.move.route;
      if (route.kind === 'warp-trail' && route.playerId === ctx.obs.playerId) {
        return 'Charts on your own warp trail — shields stay up.';
      }
      return null;
    }
    case H.coverRelief: {
      if (action.kind !== 'chart') {
        return null;
      }
      if (action.move.route.kind === 'red-alert-cover') {
        return 'Covers a Red Alert so the fleet can keep charting.';
      }
      if (action.move.route.kind === 'fracture-stabilizer') {
        return 'Stabilizes the subspace fracture; the third stabilizer also clears Red Alert on that double.';
      }
      return null;
    }
    case H.redAlertSafe: {
      if (action.kind !== 'chart' || !isDouble(action.move.coordinate)) {
        return null;
      }
      const route = action.move.route;
      if (route.kind !== 'warp-trail' && route.kind !== 'neutral-zone') {
        return null;
      }
      return 'Plays a double you can cover — avoids an stuck Red Alert.';
    }
    case H.handFlexibility: {
      if (action.kind !== 'chart') {
        return null;
      }
      const followUp = followUpCount(action, ctx);
      if (!followUp || followUp.matches < 2) {
        return null;
      }
      return `Leaves ${followUp.matches} follow-up tiles for open end ${followUp.endValue}.`;
    }
    case H.defensiveShared: {
      if (action.kind !== 'chart') {
        return null;
      }
      const route = action.move.route;
      const shared =
        route.kind === 'neutral-zone' ||
        (route.kind === 'warp-trail' && route.playerId !== ctx.obs.playerId);
      if (!shared) {
        return null;
      }
      const followUp = followUpCount(action, ctx);
      if (!followUp) {
        return null;
      }
      const rivals = unseenMatching(followUp.endValue, ctx.unseen);
      if (rivals <= 3) {
        return `Shared route ends on ${followUp.endValue} — only ${rivals} unseen tiles extend it.`;
      }
      return null;
    }
    case H.salamanderDump:
      if (
        action.kind === 'chart' &&
        action.move.coordinate.low === 12 &&
        action.move.coordinate.high === 12
      ) {
        return 'Offloads 12-12 before the Salamander penalty can apply.';
      }
      return null;
    case H.qContinuum:
      if (
        action.kind === 'chart' &&
        action.move.coordinate.low === 0 &&
        action.move.coordinate.high === 0
      ) {
        return 'Triggers a Q-Flash with 0-0.';
      }
      return null;
    default:
      return null;
  }
}

function describeActionKind(
  action: WarpAiAction,
  state: GameState,
  playerId: PlayerId
): string[] {
  switch (action.kind) {
    case 'drop-to-impulse':
      return ['Neutral Zone win available — drop to impulse.'];
    case 'invoke-q-flash':
      return [`Reality shift: ${action.effect.replaceAll('-', ' ')}.`];
    case 'resolve-q-gamble':
      return [
        `Keep gamble tile ${action.keepIndex + 1} for the best hand shape.`,
      ];
    case 'chart':
      return [];
    default:
      return explainTurnResolution(state, playerId, { focus: action.kind });
  }
}

/** Human-readable factors that favor a suggested advisor move (heuristic layer). */
export function explainWarpAiAction(
  state: GameState,
  playerId: PlayerId,
  action: WarpAiAction,
  options?: { maxReasons?: number }
): string[] {
  const maxReasons = options?.maxReasons ?? 3;
  const obs = observe(state, playerId);
  if (!obs) {
    return [];
  }

  const kindReasons = describeActionKind(action, state, playerId);
  if (kindReasons.length > 0) {
    return kindReasons.slice(0, maxReasons);
  }

  const skill = getWarpSkillProfile('advanced', state.objective);
  const byId = new Map(
    DEFAULT_WARP_HEURISTICS.map((heuristic) => [heuristic.id, heuristic] as const)
  );
  const ctx = buildWarpContext(obs, Math.random);

  const ranked: { impact: number; text: string }[] = [];
  for (const id of skill.enabled) {
    const heuristic = byId.get(id);
    if (!heuristic) {
      continue;
    }
    const raw = heuristic.score(action, ctx);
    const weight = skill.weights[id] ?? 1;
    const text = describeHeuristicContribution(id, action, ctx, raw);
    if (!text) {
      continue;
    }
    ranked.push({ impact: Math.abs(weight * raw), text });
  }

  ranked.sort((a, b) => b.impact - a.impact);

  const seen = new Set<string>();
  const reasons: string[] = [];
  for (const entry of ranked) {
    if (seen.has(entry.text)) {
      continue;
    }
    seen.add(entry.text);
    reasons.push(entry.text);
    if (reasons.length >= maxReasons) {
      break;
    }
  }

  if (reasons.length === 0 && action.kind === 'chart') {
    const total = scoreWithHeuristics(action, ctx, byId, skill);
    if (total > 0) {
      reasons.push('Best balance of pip shed, trail control, and follow-up options.');
    }
  }

  return reasons;
}
