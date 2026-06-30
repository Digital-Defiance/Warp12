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
import {
  countChainPlaysFromOpenEnd,
  defensiveBlockingMultiplier,
  minOpponentHandSize as minOpponentHandSizeFromObs,
} from './go-out-race.js';

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
  /** Build on own trail while the hand is still long; dump remnants on shared routes late. */
  goOutTrailPriority: 'go-out-trail-priority',
  /** Avoid doubles on Neutral Zone / opponent trails that trigger Red Alert chaos. */
  goOutAvoidMayhem: 'go-out-avoid-mayhem',
  /** Dump phase: play leftovers on the Neutral Zone. */
  goOutNeutralZoneDump: 'go-out-neutral-zone-dump',
  /** Dump phase: play leftovers on opponent warp trails. */
  goOutOpponentTrailDump: 'go-out-opponent-trail-dump',
  /** Slow rivals near empty when they lead the race. */
  goOutBlockLeader: 'go-out-block-leader',
  /** Avoid drawing when a small hand can still chart. */
  goOutDrawReluctance: 'go-out-draw-reluctance',
  /** Deploy a beacon when stuck with no chart. */
  goOutBeaconDiscipline: 'go-out-beacon-discipline',
  /** Path-to-zero setup: chain length unlocked for the following turn. */
  goOutFeasibility: 'go-out-feasibility',
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

/** Prefer moves that shrink the hand quickly in go-out mode. */
const goOutWin: WarpHeuristic = {
  id: H.goOutWin,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out') return 0;
    if (action.kind !== 'chart') return 0;
    const tilesAfter = ctx.hand.length - 1;
    if (tilesAfter === 0) return 200;
    const opponents = Math.max(1, ctx.obs.captains.length - 1);
    const tuning = ctx.goOutTuning;
    let score = (14 - tilesAfter) * (1 + 0.08 * (opponents - 1));
    if (tilesAfter <= tuning.sprintHandSize && opponents >= 2) {
      score += (tuning.sprintHandSize + 1 - tilesAfter) * 4 * opponents;
    }
    return score;
  },
};

function isSharedChartRoute(
  route: Extract<WarpAiAction, { kind: 'chart' }>['move']['route'],
  playerId: string
): boolean {
  return (
    route.kind === 'neutral-zone' ||
    (route.kind === 'warp-trail' && route.playerId !== playerId)
  );
}

function minOpponentHandSize(ctx: WarpEvalContext): number {
  return minOpponentHandSizeFromObs(
    ctx.obs,
    ctx.obs.playerId,
    ctx.hand.length
  );
}

function goOutDumpPhase(ctx: WarpEvalContext): boolean {
  const handSize = ctx.hand.length;
  const playerId = ctx.obs.playerId;
  const tuning = ctx.goOutTuning;
  const ownTrailLen =
    ctx.obs.round.table.warpTrails[playerId]?.tiles.length ?? 0;
  const minOppHand = minOpponentHandSize(ctx);
  const tableSize = Math.max(2, ctx.obs.captains.length);
  const buildTrailTarget =
    tableSize >= 4 ? tuning.trailBuildTarget4p : tuning.trailBuildTargetSmall;
  const opponentNearOut = minOppHand <= tuning.blockLeaderHandSize;
  const handBehind = handSize - minOppHand;
  return (
    handSize <= 3 ||
    ownTrailLen >= buildTrailTarget ||
    (opponentNearOut && handSize <= tuning.sprintHandSize) ||
    (tableSize >= 4 && handBehind >= 2) ||
    (tableSize >= 3 && handBehind >= 3)
  );
}

/**
 * Go-out: chain on your own Warp Trail while the hand is still long, then play
 * leftovers on the Neutral Zone and other trails once the train is built or
 * rivals are close to empty.
 */
const goOutTrailPriority: WarpHeuristic = {
  id: H.goOutTrailPriority,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'chart') return 0;

    const route = action.move.route;
    const handSize = ctx.hand.length;
    const playerId = ctx.obs.playerId;
    const onOwnTrail =
      route.kind === 'warp-trail' && route.playerId === playerId;
    if (!onOwnTrail) return 0;

    const dumpPhase = goOutDumpPhase(ctx);
    if (ctx.goOutRacePhase === 'defensive' && !dumpPhase) {
      return -8 - handSize;
    }
    if (dumpPhase && handSize > 1) {
      return 2;
    }

    const endValue = newOpenEndValue(action, ctx);
    let chainLinks = 0;
    if (endValue !== null) {
      const tileKey = coordinateKey(action.move.coordinate);
      let skipped = false;
      for (const coordinate of ctx.hand) {
        if (!skipped && coordinateKey(coordinate) === tileKey) {
          skipped = true;
          continue;
        }
        if (coordinateMatchesValue(coordinate, endValue)) {
          chainLinks++;
        }
      }
    }
    return 10 + Math.min(handSize, 9) * 2 + chainLinks * 5;
  },
};

const goOutNeutralZoneDump: WarpHeuristic = {
  id: H.goOutNeutralZoneDump,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'chart') return 0;
    if (action.move.route.kind !== 'neutral-zone') return 0;
    const handSize = ctx.hand.length;
    if (!goOutDumpPhase(ctx)) {
      if (handSize <= 4) return -4;
      return -6 - handSize;
    }
    if (ctx.goOutRacePhase === 'defensive') {
      return 14 + Math.max(0, 4 - handSize) * 3;
    }
    return 8 + Math.max(0, 4 - handSize) * 2;
  },
};

const goOutOpponentTrailDump: WarpHeuristic = {
  id: H.goOutOpponentTrailDump,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'chart') return 0;
    const route = action.move.route;
    if (
      route.kind !== 'warp-trail' ||
      route.playerId === ctx.obs.playerId
    ) {
      return 0;
    }
    const handSize = ctx.hand.length;
    if (!goOutDumpPhase(ctx)) {
      if (handSize <= 4) return -2;
      return -4 - handSize;
    }
    return 6 + Math.max(0, 4 - handSize) * 2;
  },
};

/** Go-out: skip deliberate Red Alert mayhem on shared routes unless it empties the hand. */
const goOutAvoidMayhem: WarpHeuristic = {
  id: H.goOutAvoidMayhem,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'chart') return 0;
    if (ctx.hand.length <= 1) return 0;

    const route = action.move.route;
    if (!isSharedChartRoute(route, ctx.obs.playerId)) return 0;

    let penalty = -6;
    if (isDouble(action.move.coordinate)) {
      penalty -= ctx.goOutTuning.mayhemDoublePenalty;
    }
    if (ctx.hand.length >= 6) {
      penalty -= 8;
    }
    return penalty;
  },
};

/** When a rival is near empty, leave shared ends that are easy to extend. */
const goOutBlockLeader: WarpHeuristic = {
  id: H.goOutBlockLeader,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'chart') return 0;
    if (minOpponentHandSize(ctx) > ctx.goOutTuning.blockLeaderHandSize) {
      return 0;
    }
    const route = action.move.route;
    if (!isSharedChartRoute(route, ctx.obs.playerId)) return 0;

    const endValue = newOpenEndValue(action, ctx);
    if (endValue === null) return 0;

    let openCount = 0;
    for (const coordinate of ctx.unseen) {
      if (coordinateMatchesValue(coordinate, endValue)) openCount++;
    }
    const block =
      -openCount * 3 - (ctx.hand.length <= 2 ? openCount * 2 : 0);
    return block * defensiveBlockingMultiplier(ctx.goOutRacePhase);
  },
};

/**
 * Scores how completely this chart sets up emptying the hand on following turns
 * (greedy chain from the new open end through remaining tiles).
 */
const goOutFeasibility: WarpHeuristic = {
  id: H.goOutFeasibility,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'chart') return 0;

    const tilesAfter = ctx.hand.length - 1;
    if (tilesAfter === 0) return 0;

    const endValue = newOpenEndValue(action, ctx);
    if (endValue === null) return 0;

    const tileKey = coordinateKey(action.move.coordinate);
    const chain = countChainPlaysFromOpenEnd(endValue, ctx.hand, tileKey);

    if (chain >= tilesAfter) {
      return 80 + tilesAfter * 6;
    }
    if (chain === tilesAfter - 1) {
      return 35 + chain * 5;
    }
    return chain * 4;
  },
};

/** Drawing with a small hand and legal charts wastes tempo in a race. */
const goOutDrawReluctance: WarpHeuristic = {
  id: H.goOutDrawReluctance,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'draw') return 0;
    if (ctx.hand.length > ctx.goOutTuning.drawReluctanceHandSize) return 0;
    const charts = getLegalMoves(
      ctx.obs.round,
      ctx.obs.playerId,
      ctx.obs.houseRules
    ).length;
    if (charts <= 0) return 0;
    return -20 - ctx.hand.length * 4;
  },
};

/** Deploy a Distress Beacon when stuck with tiles but no legal chart. */
const goOutBeaconDiscipline: WarpHeuristic = {
  id: H.goOutBeaconDiscipline,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out' || action.kind !== 'deploy-beacon') {
      return 0;
    }
    const charts = getLegalMoves(
      ctx.obs.round,
      ctx.obs.playerId,
      ctx.obs.houseRules
    ).length;
    if (charts > 0 || ctx.hand.length === 0) return 0;
    return 45;
  },
};

/** Offload doubles while the hand is full; they get harder to place late. */
const playDoublesEarly: WarpHeuristic = {
  id: H.doublesEarly,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (!isDouble(action.move.coordinate)) return 0;
    if (ctx.obs.objective === 'go-out') {
      const route = action.move.route;
      const onOwnTrail =
        route.kind === 'warp-trail' && route.playerId === ctx.obs.playerId;
      if (!onOwnTrail) return -10;
    }
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
  goOutTrailPriority,
  goOutNeutralZoneDump,
  goOutOpponentTrailDump,
  goOutAvoidMayhem,
  goOutBlockLeader,
  goOutDrawReluctance,
  goOutBeaconDiscipline,
  goOutFeasibility,
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
