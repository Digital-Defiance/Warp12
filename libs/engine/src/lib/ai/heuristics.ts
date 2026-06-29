import type { GenericHeuristic } from 'doubletwelve';
import { salamanderPenaltyApplies } from '../constants/setup.js';
import { getLegalMoves } from '../engine/legal-moves.js';
import {
  coordinateKey,
  coordinateMatchesValue,
  coordinatePipValue,
  isDouble,
  openValueAfterConnection,
} from '../types/coordinate.js';
import type { WarpAiAction } from './actions.js';
import {
  connectingValueForRoute,
  type WarpEvalContext,
} from './context.js';

export type WarpHeuristic = GenericHeuristic<WarpAiAction, WarpEvalContext>;

/** Stable ids for referencing/overriding Warp heuristics in skill profiles. */
export const WARP_HEURISTIC_IDS = {
  preferChart: 'prefer-chart',
  dumpPips: 'dump-pips',
  doublesEarly: 'play-doubles-early',
  ownTrail: 'own-trail',
  coverRelief: 'cover-relief',
  redAlertSafe: 'red-alert-safe',
  handFlexibility: 'hand-flexibility',
  defensiveShared: 'defensive-shared',
  salamanderDump: 'salamander-dump',
  qContinuum: 'q-continuum',
  goOutWin: 'go-out-win',
  dropToImpulseDeclare: 'drop-to-impulse-declare',
  dropToImpulseCatch: 'catch-drop-to-impulse',
  dropToImpulseForget: 'drop-to-impulse-forget',
} as const;

const H = WARP_HEURISTIC_IDS;

/** Open pip value left exposed after charting this move (null if it can't connect). */
function newOpenEndValue(
  action: Extract<WarpAiAction, { kind: 'chart' }>,
  ctx: WarpEvalContext
): number | null {
  const connecting = connectingValueForRoute(ctx.obs.round, action.move.route);
  if (connecting === null) return null;
  return openValueAfterConnection(action.move.coordinate, connecting);
}

/**
 * Keep play moving. Charting beats everything but a mandatory all stop; drawing is
 * neutral; deploying a beacon / passing a Red Alert are last resorts. Competent
 * profiles thus always chart when they can — mistakes come from the blunder rate.
 */
const preferChart: WarpHeuristic = {
  id: H.preferChart,
  score(action: WarpAiAction): number {
    switch (action.kind) {
      case 'all-stop':
        return 200;
      case 'catch-drop-to-impulse':
        return 180;
      case 'chart':
        return 100;
      case 'drop-to-impulse':
        return 55;
      case 'draw':
        return 0;
      case 'pass-red-alert':
        return -20;
      case 'pass-turn':
        return -30;
      case 'deploy-beacon':
        return -40;
      case 'return-to-warp':
        return -500;
      case 'invoke-q-flash':
      case 'resolve-q-gamble':
        return 150;
    }
  },
};

/** Shed pip weight first to minimize end-of-round penalty (RULES.md §V). */
const dumpPips: WarpHeuristic = {
  id: H.dumpPips,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (ctx.obs.objective === 'go-out') return 0;
    return coordinatePipValue(action.move.coordinate);
  },
};

/** First-out mode: strongly prefer the move that empties your hand. */
const goOutWin: WarpHeuristic = {
  id: H.goOutWin,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out') return 0;
    if (action.kind !== 'chart') return 0;
    return ctx.hand.length === 1 ? 200 : 0;
  },
};

/** Offload doubles while the hand is full; they get harder to place late. */
const playDoublesEarly: WarpHeuristic = {
  id: H.doublesEarly,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (!isDouble(action.move.coordinate)) return 0;
    return Math.min(ctx.hand.length, 12);
  },
};

/** Charting on your own Warp Trail keeps shields up and the route under control. */
const ownTrail: WarpHeuristic = {
  id: H.ownTrail,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    const route = action.move.route;
    return route.kind === 'warp-trail' && route.playerId === ctx.obs.playerId
      ? 8
      : 0;
  },
};

/** Resolving a blocking anomaly (cover a Red Alert / stabilize a Fracture) unblocks the fleet. */
const coverRelief: WarpHeuristic = {
  id: H.coverRelief,
  score(action: WarpAiAction): number {
    if (action.kind !== 'chart') return 0;
    const kind = action.move.route.kind;
    return kind === 'red-alert-cover' || kind === 'fracture-stabilizer' ? 12 : 0;
  },
};

/**
 * Don't trigger a Red Alert you can't neutralize: charting a double on any
 * eligible route raises an alert you must immediately cover.
 */
const redAlertSafe: WarpHeuristic = {
  id: H.redAlertSafe,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    const { coordinate, route } = action.move;
    const eligibleDoubleRoute =
      route.kind === 'warp-trail' || route.kind === 'neutral-zone';
    if (!eligibleDoubleRoute || !isDouble(coordinate)) return 0;

    const doubleValue = coordinate.low;
    const tileKey = coordinateKey(coordinate);
    const canCover = ctx.hand.some(
      (c) =>
        coordinateKey(c) !== tileKey && coordinateMatchesValue(c, doubleValue)
    );
    return canCover ? 0 : -60;
  },
};

/** Prefer leaving yourself a follow-up: count remaining tiles that fit the new open end. */
const handFlexibility: WarpHeuristic = {
  id: H.handFlexibility,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    const endValue = newOpenEndValue(action, ctx);
    if (endValue === null) return 0;

    const tileKey = coordinateKey(action.move.coordinate);
    let skipped = false;
    let matches = 0;
    for (const coordinate of ctx.hand) {
      if (!skipped && coordinateKey(coordinate) === tileKey) {
        skipped = true;
        continue;
      }
      if (coordinateMatchesValue(coordinate, endValue)) matches++;
    }
    return matches * 2;
  },
};

/**
 * Defensive play on shared routes (Neutral Zone or an opponent's open trail):
 * prefer leaving an open end few unseen tiles can extend, slowing rivals.
 */
const defensiveShared: WarpHeuristic = {
  id: H.defensiveShared,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    const route = action.move.route;
    const shared =
      route.kind === 'neutral-zone' ||
      (route.kind === 'warp-trail' && route.playerId !== ctx.obs.playerId);
    if (!shared) return 0;

    const endValue = newOpenEndValue(action, ctx);
    if (endValue === null) return 0;

    let openCount = 0;
    for (const coordinate of ctx.unseen) {
      if (coordinateMatchesValue(coordinate, endValue)) openCount++;
    }
    return -openCount;
  },
};

/**
 * Module Beta (Salamander): holding 12-12 at round end costs 24, not 12. The
 * tile is Spacedock in round 1 and never in hand; this applies from round 2 on.
 */
const salamanderDump: WarpHeuristic = {
  id: H.salamanderDump,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (ctx.obs.objective === 'go-out') return 0;
    if (!ctx.obs.modules.salamanderPenalty.enabled) return 0;
    if (!salamanderPenaltyApplies(ctx.obs.round.roundNumber)) return 0;
    const { low, high } = action.move.coordinate;
    return low === 12 && high === 12 ? 50 : 0;
  },
};

/**
 * Module Alpha (Q-Continuum): playing the 0-0 triggers a reality-bending
 * Q-Flash. When enabled, value seizing that effect despite the tile's 0 pips.
 */
const qContinuum: WarpHeuristic = {
  id: H.qContinuum,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (!ctx.obs.modules.qContinuum.enabled) return 0;
    const { low, high } = action.move.coordinate;
    return low === 0 && high === 0 ? 15 : 0;
  },
};

/**
 * Drop to Impulse: strongly prefer announcing when stuck at one tile with no
 * chart; a small bonus when a legal chart exists (table manners).
 */
const dropToImpulseDeclare: WarpHeuristic = {
  id: H.dropToImpulseDeclare,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'drop-to-impulse') return 0;
    if (!ctx.obs.houseRules.dropToImpulseCall) return 0;
    if (ctx.obs.round.dropToImpulseCallPending !== ctx.obs.playerId) return 0;
    if (ctx.hand.length !== 1) return 0;

    const hasChart = getLegalMoves(
      ctx.obs.round,
      ctx.obs.playerId,
      ctx.obs.houseRules
    ).length > 0;
    if (!hasChart) {
      return 80;
    }
    return ctx.obs.objective === 'go-out' ? 8 : 5;
  },
};

/** Always catch a missed Drop to Impulse when the draw pile can penalize. */
const dropToImpulseCatch: WarpHeuristic = {
  id: H.dropToImpulseCatch,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'catch-drop-to-impulse') return 0;
    if (!ctx.obs.houseRules.dropToImpulseCall) return 0;
    if (ctx.obs.round.dropToImpulseCatchable !== action.targetPlayerId) return 0;
    return ctx.obs.round.unchartedSectors.length > 0 ? 120 : 0;
  },
};

/**
 * Beginner-only temptation to pass without declaring — models forgetting the
 * ceremony at a live table.
 */
const dropToImpulseForget: WarpHeuristic = {
  id: H.dropToImpulseForget,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'pass-turn') return 0;
    if (!ctx.obs.houseRules.dropToImpulseCall) return 0;
    if (ctx.obs.round.dropToImpulseCallPending !== ctx.obs.playerId) return 0;
    if (ctx.hand.length !== 1) return 0;
    if (
      getLegalMoves(ctx.obs.round, ctx.obs.playerId, ctx.obs.houseRules).length > 0
    ) {
      return 0;
    }
    return 35;
  },
};

/** The stock Warp 12 heuristic set. Append/replace by `id` to add house tactics. */
export const DEFAULT_WARP_HEURISTICS: WarpHeuristic[] = [
  preferChart,
  dumpPips,
  goOutWin,
  playDoublesEarly,
  ownTrail,
  coverRelief,
  redAlertSafe,
  handFlexibility,
  defensiveShared,
  salamanderDump,
  qContinuum,
  dropToImpulseDeclare,
  dropToImpulseCatch,
  dropToImpulseForget,
];
