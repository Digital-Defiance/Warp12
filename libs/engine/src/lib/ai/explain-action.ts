import { scoreWithHeuristics } from 'double-eighteen';

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
import { getAdvisorSkillProfile } from './skill.js';
import { explainTurnResolution } from './explain-turn-resolution.js';
import { routeIsOwnTrail } from '../engine/squadrons.js';

const H = WARP_HEURISTIC_IDS;

/** Heuristics whose reason text is written to handle a negative (penalty) score. */
const WARNING_CAPABLE_HEURISTICS = new Set<string>([
  H.dumpPips,
  H.goOutWin,
  H.temporalInversion,
  H.salamanderDump,
]);

function isInvertedRound(ctx: WarpEvalContext): boolean {
  const enabled = ctx.obs.modules?.temporalInversion?.enabled ?? false;
  return enabled && ctx.obs.round.roundNumber % 2 === 0;
}

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

  // Never phrase a penalty as a benefit. Heuristics with two-sided wording
  // (module-aware ones) opt in via WARNING_CAPABLE_HEURISTICS.
  if (rawScore < 0 && !WARNING_CAPABLE_HEURISTICS.has(id)) {
    return null;
  }

  switch (id) {
    case H.dumpPips: {
      if (action.kind !== 'chart' || ctx.obs.objective === 'go-out') {
        return null;
      }
      const pips = coordinatePipValue(action.move.coordinate);
      if (isInvertedRound(ctx)) {
        // Inverted round: shedding pips is a demerit, so frame it as a caution.
        if (pips >= 10) {
          return `Sheds ${pips} pip points — but this inverted round rewards holding heavy tiles.`;
        }
        return null;
      }
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
        if (isInvertedRound(ctx)) {
          return 'Empties your hand — but the inverted round scores that as the maximum penalty.';
        }
        return 'Empties your hand — you win the round.';
      }
      return null;
    case H.temporalInversion: {
      if (!isInvertedRound(ctx)) {
        return null;
      }
      if (action.kind === 'draw') {
        return 'Inverted round — drawing grows your hand toward the highest-hand win.';
      }
      if (action.kind !== 'chart') {
        return null;
      }
      const tilesAfter = ctx.hand.length - 1;
      if (tilesAfter === 0) {
        return 'Going out empties your hand — the worst result on an inverted round (maximum penalty).';
      }
      const pips = coordinatePipValue(action.move.coordinate);
      if (pips >= 10) {
        return 'Inverted round — hold heavy tiles; the highest hand wins.';
      }
      if (pips <= 6) {
        return 'Sheds only a light tile while keeping your heavy hand — right for an inverted round.';
      }
      return null;
    }
    case H.longestTrailBonus: {
      if (action.kind !== 'chart') {
        return null;
      }
      if (!routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, action.move.route)) {
        return null;
      }
      const bonus = ctx.obs.modules?.longestTrail?.bonus ?? -3;
      return `Builds your warp trail toward the longest-trail bonus (${bonus} at round end).`;
    }
    case H.doubleDownTiming:
      if (action.kind === 'chart' && isDouble(action.move.coordinate)) {
        return 'Times a double to force the next captain to draw (Double Down).';
      }
      return null;
    case H.goOutTrailPriority: {
      if (action.kind !== 'chart') return null;
      const route = action.move.route;
      if (routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, route)) {
        return 'Extends your warp trail train before dumping leftovers.';
      }
      return null;
    }
    case H.goOutNeutralZoneDump:
      if (action.kind === 'chart' && action.move.route.kind === 'neutral-zone') {
        return 'Dumps a leftover tile on the Neutral Zone.';
      }
      return null;
    case H.goOutOpponentTrailDump:
      if (
        action.kind === 'chart' &&
        action.move.route.kind === 'warp-trail' &&
        !routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, action.move.route)
      ) {
        return 'Dumps a leftover tile on an opponent warp trail.';
      }
      return null;
    case H.goOutAvoidMayhem:
      if (
        action.kind === 'chart' &&
        isDouble(action.move.coordinate)
      ) {
        return 'Avoids a double on a shared route that would trigger Red Alert.';
      }
      return null;
    case H.goOutBlockLeader: {
      if (action.kind !== 'chart') return null;
      const followUp = followUpCount(action, ctx);
      if (!followUp) return null;
      const rivals = unseenMatching(followUp.endValue, ctx.unseen);
      if (rivals >= 4) return null;
      return `Rival near empty — leaves a tight ${followUp.endValue} end (${rivals} unseen extenders).`;
    }
    case H.goOutDrawReluctance:
      if (action.kind === 'draw') {
        return 'Drawing with a small hand wastes tempo in a go-out race.';
      }
      return null;
    case H.goOutBeaconDiscipline:
      if (action.kind === 'deploy-beacon') {
        return 'Deploys a Distress Beacon when stuck with no chart.';
      }
      return null;
    case H.goOutFeasibility: {
      if (action.kind !== 'chart') return null;
      const followUp = followUpCount(action, ctx);
      if (!followUp || followUp.matches < 1) return null;
      if (followUp.matches >= ctx.hand.length - 1) {
        return 'Sets up emptying your hand on the next turn.';
      }
      return `Opens a ${followUp.matches}-tile path toward going out.`;
    }
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
      if (routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, route)) {
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
    case H.salamanderDump: {
      const maxPip = ctx.obs.maxPip ?? 12;
      if (
        action.kind === 'chart' &&
        action.move.coordinate.low === maxPip &&
        action.move.coordinate.high === maxPip
      ) {
        if (isInvertedRound(ctx)) {
          return `Dumps ${maxPip}-${maxPip} — but on an inverted round the doubled Salamander tile is your best keeper.`;
        }
        return `Offloads ${maxPip}-${maxPip} before the Salamander penalty can apply.`;
      }
      return null;
    }
    case H.continuum:
      if (
        action.kind === 'chart' &&
        action.move.coordinate.low === 0 &&
        action.move.coordinate.high === 0
      ) {
        return 'Triggers a Continuum Flash with 0-0.';
      }
      return null;
    case H.dropToImpulseDeclare:
      if (action.kind === 'drop-to-impulse') {
        return 'Announces Drop to Impulse before opponents can catch you.';
      }
      return null;
    case H.dropToImpulseCatch:
      if (action.kind === 'catch-drop-to-impulse') {
        const tiles = ctx.obs.houseRules.dropToImpulseCatchPenalty;
        return `Penalizes a missed Drop to Impulse with ${tiles} draw${tiles === 1 ? '' : 's'} from Uncharted Sectors.`;
      }
      return null;
    case H.dropToImpulseForget:
      if (action.kind === 'pass-turn') {
        return 'Passes without declaring — opponents may catch you.';
      }
      return null;
    default:
      return null;
  }
}

function describeActionKind(
  action: WarpAiAction,
  state: GameState,
  playerId: PlayerId,
  names: Readonly<Record<string, string>> = {}
): string[] {
  const round = state.round;
  switch (action.kind) {
    case 'all-stop':
      if (round?.continuumEffects?.allStopEcho) {
        return ['Round win pending — call All Stop!'];
      }
      return ['Neutral Zone win available — call All Stop!'];
    case 'raise-shields':
      return [
        'Raise shields — close your warp trail until you drop shields again.',
      ];
    case 'drop-to-impulse':
      return ['One coordinate left — announce Drop to Impulse!'];
    case 'catch-drop-to-impulse': {
      const target = names[action.targetPlayerId] ?? action.targetPlayerId;
      return [
        `Catch missed Drop to Impulse · ${target} forgot to announce`,
        `${target} returns to warp by drawing from Uncharted Sectors`,
      ];
    }
    case 'invoke-continuum-flash':
      return [`Reality shift: ${action.effect.replaceAll('-', ' ')}.`];
    case 'resolve-continuum-wager':
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
  options?: { maxReasons?: number; names?: Readonly<Record<string, string>> }
): string[] {
  const maxReasons = options?.maxReasons ?? 3;
  const obs = observe(state, playerId);
  if (!obs) {
    return [];
  }

  const kindReasons = describeActionKind(
    action,
    state,
    playerId,
    options?.names ?? {}
  );
  if (kindReasons.length > 0) {
    return kindReasons.slice(0, maxReasons);
  }

  const skill = getAdvisorSkillProfile(
    state.objective,
    obs.captains.length,
    state.modules
  );
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
