import type { GenericHeuristic } from 'double-eighteen';
import { handSizeForPlayerCount, salamanderPenaltyApplies } from '../constants/setup.js';
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
import { routeIsOwnTrail, trailKeyFor } from '../engine/squadrons.js';
import { scoreHandExchangeGiveback } from './hand-exchange-ai.js';
import { estimateSpoolValue } from './spool-strategy.js';

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
  continuum: 'continuum',
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
  /** Module Delta: Warp Drive Spool strategy (risk/reward, NZ vs own trail, game phase). */
  spoolStrategy: 'spool-strategy',
  /** Module Delta: avoid passing while holding the Hot Potato. */
  hotPotatoPass: 'hot-potato-pass',
  /** Module Beta (Go-out): Salamander Surge — dump max double to force opponent draws. */
  salamanderSurge: 'salamander-surge',
  /** Module Theta (Go-out): Trail Momentum — race personal trail to length 5. */
  trailMomentum: 'trail-momentum',
  /** Module Kappa: Temporal Inversion - hand size management on inverted rounds. */
  temporalInversion: 'temporal-inversion',
  /** Module Kappa (Go-out): Hand Exchange give-back tile selection. */
  handExchangeGiveback: 'hand-exchange-giveback',
  /** Module Theta: Longest Trail bonus value. */
  longestTrailBonus: 'longest-trail-bonus',
  /** Module Iota: Double Down timing strategy. */
  doubleDownTiming: 'double-down-timing',
  /** Module Zeta: bias toward the shared squad trail (public-info only, no hand sharing). */
  squadCoordination: 'squad-coordination',
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
 * Keep play moving. Charting/spooling beats everything but a mandatory all stop; drawing is
 * neutral; deploying a beacon / passing a Red Alert are last resorts. Competent
 * profiles thus always chart/spool when they can — mistakes come from the blunder rate.
 * 
 * Module Epsilon (Drafting): During drafting phase, pick-from-pack actions are scored by
 * coordinate quality (handled by tile-specific heuristics like dumpPips, openValue, etc).
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
      case 'spool':
        return 95; // Slightly below chart (spool heuristic adds detail)
      case 'drop-to-impulse':
        return 55;
      case 'pick-from-pack':
        return 0; // Neutral; actual value comes from tile quality heuristics
      case 'resolve-hand-exchange':
        return 150;
      case 'desperation-dig':
        return 15;
      case 'draw':
        return 0;
      case 'pass-red-alert':
        return -20;
      case 'pass-turn':
        return -30;
      case 'deploy-beacon':
        return -40;
      case 'raise-shields':
        return -20;
      case 'invoke-continuum-flash':
      case 'resolve-continuum-wager':
        return 150;
    }
  },
};

/** Shed pip weight first to minimize end-of-round penalty (RULES.md §V). */
const dumpPips: WarpHeuristic = {
  id: H.dumpPips,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart' && action.kind !== 'pick-from-pack') return 0;
    if (ctx.obs.objective === 'go-out') return 0;
    
    const coordinate = action.kind === 'chart' ? action.move.coordinate : action.coordinate;
    
    // Module Kappa: Temporal Inversion - on even rounds, KEEP pips instead of dumping
    const temporalInversion = ctx.obs.modules?.temporalInversion?.enabled ?? false;
    const isInvertedRound = temporalInversion && ctx.obs.round.roundNumber % 2 === 0;
    
    const pipValue = coordinatePipValue(coordinate);
    
    // Even rounds with Kappa: NEGATIVE score for high pips (we want to keep them!)
    if (isInvertedRound) {
      return -pipValue * 0.8; // Slightly less penalty than normal bonus to allow some flexibility
    }
    
    // Normal rounds: positive score for high pips (dump them)
    return pipValue;
  },
};

/** Prefer moves that shrink the hand quickly in go-out mode. */
const goOutWin: WarpHeuristic = {
  id: H.goOutWin,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out') return 0;
    if (action.kind !== 'chart') return 0;
    
    const tilesAfter = ctx.hand.length - 1;
    
    // Module Kappa: Temporal Inversion - NEVER go out on even rounds!
    const temporalInversion = ctx.obs.modules?.temporalInversion?.enabled ?? false;
    const isInvertedRound = temporalInversion && ctx.obs.round.roundNumber % 2 === 0;
    
    if (isInvertedRound && tilesAfter === 0) {
      // Going out on inverted round is CATASTROPHIC - you get maximum penalty
      return -1000; // Massive negative score to prevent this
    }
    
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
    ctx.obs.round.table.warpTrails[trailKeyFor(ctx.obs.round, playerId)]
      ?.tiles.length ?? 0;
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
    const onOwnTrail = routeIsOwnTrail(ctx.obs.round, playerId, route);
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
      routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, route)
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
    if (ctx.obs.objective !== 'go-out') return 0;
    if (ctx.hand.length > ctx.goOutTuning.drawReluctanceHandSize) return 0;
    const charts = getLegalMoves(
      ctx.obs.round,
      ctx.obs.playerId,
      ctx.obs.houseRules
    ).length;
    if (action.kind === 'desperation-dig') {
      // When stuck, dig beats blind draw; when charts exist, dig is rare.
      return charts <= 0 ? 14 : -4;
    }
    if (action.kind !== 'draw') return 0;
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
      const onOwnTrail = routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, route);
      if (!onOwnTrail) return -10;
    }
    return Math.min(ctx.hand.length, 12);
  },
};

/** Charting on your own (squad) Warp Trail keeps shields up and the route under control. */
const ownTrail: WarpHeuristic = {
  id: H.ownTrail,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    const route = action.move.route;
    return routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, route) ? 8 : 0;
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
    // Shared = Neutral Zone, or a genuinely opposing squad's open trail — never
    // a squadmate's own (shared) trail, which you want to help, not hinder.
    const shared =
      route.kind === 'neutral-zone' ||
      (route.kind === 'warp-trail' &&
        !routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, route));
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
 * Module Beta (Salamander): holding the highest double at round end costs
 * double its pips. The tile is Spacedock in round 1 and never in hand; this
 * applies from round 2 on.
 */
const salamanderDump: WarpHeuristic = {
  id: H.salamanderDump,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (ctx.obs.objective === 'go-out') return 0;
    if (!ctx.obs.modules.salamanderPenalty.enabled) return 0;
    if (!salamanderPenaltyApplies(ctx.obs.round.roundNumber)) return 0;
    const { low, high } = action.move.coordinate;
    const maxPip = ctx.obs.maxPip ?? 12;
    return low === maxPip && high === maxPip ? 50 : 0;
  },
};

/**
 * Module Zeta (Squadrons): bias toward playing on the shared squad trail so
 * the AI actively cooperates with its squadmate rather than treating the
 * shared trail as neutral. Uses only public information (trail contents,
 * beacon state, own hand) — no squadmate hand is inspected, matching the
 * no-shared-info decision.
 *
 * Weight is set per commission track in skill.ts (`squadCoordination`), so
 * Commander AI coordinates more strongly than Ensign.
 */
const squadCoordination: WarpHeuristic = {
  id: H.squadCoordination,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (!ctx.obs.round.squadrons?.length) return 0;
    const route = action.move.route;
    if (!routeIsOwnTrail(ctx.obs.round, ctx.obs.playerId, route)) return 0;

    let value = 6; // Base nudge toward the shared squad trail over solo routes.

    // Extra credit for clearing (or keeping clear) the squad's shared beacon —
    // public info: any squadmate charting the shared trail lifts shields for
    // everyone, so this is a real cooperative payoff, not a guess about hands.
    const trailKey = trailKeyFor(ctx.obs.round, ctx.obs.playerId);
    const beaconWasDown =
      ctx.obs.round.table.warpTrails[trailKey]?.distressBeacon.active === true;
    if (beaconWasDown) {
      value += 10;
    }

    return value;
  },
};

/**
 * Module Alpha (Continuum): playing the 0-0 triggers a reality-bending
 * Continuum Flash. When enabled, value seizing that effect despite the tile's 0 pips.
 */
const continuum: WarpHeuristic = {
  id: H.continuum,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (!ctx.obs.modules.continuum.enabled) return 0;
    const { low, high } = action.move.coordinate;
    return low === 0 && high === 0 ? 15 : 0;
  },
};

/**
 * Drop to Impulse: strongly prefer announcing when stuck at one tile with no
 * chart; a small bonus when going out on a later turn after announcing.
 */
const dropToImpulseDeclare: WarpHeuristic = {
  id: H.dropToImpulseDeclare,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'drop-to-impulse') return 0;
    if (!ctx.obs.houseRules.dropToImpulseCall) return 0;
    if (ctx.obs.round.dropToImpulseCallPending !== ctx.obs.playerId) return 0;
    if (ctx.hand.length !== 1) return 0;

    return ctx.obs.objective === 'go-out' ? 80 : 75;
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
    return 35;
  },
};

/**
 * Module Delta: Warp Drive Spool strategy — delegates to estimateSpoolValue
 * (mismatch + unfinished-double abort awareness).
 */
const spoolStrategy: WarpHeuristic = {
  id: H.spoolStrategy,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'spool') return 0;
    const route = action.option.route;
    const routePlayerId =
      route.kind === 'warp-trail' ? route.playerId : null;
    return estimateSpoolValue(ctx.obs, routePlayerId);
  },
};

/**
 * Module Beta (Go-out) Salamander Surge: charting maxPip-maxPip forces each
 * opponent to draw 1. Prefer when opponents are racing (small hands).
 */
const salamanderSurge: WarpHeuristic = {
  id: H.salamanderSurge,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'chart') return 0;
    if (ctx.obs.objective !== 'go-out') return 0;
    if (!ctx.obs.modules.salamanderPenalty.enabled) return 0;
    const maxPip = ctx.obs.maxPip ?? 12;
    const { low, high } = action.move.coordinate;
    if (low !== maxPip || high !== maxPip) return 0;

    let value = 18;
    for (const captain of ctx.obs.captains) {
      if (captain.id === ctx.obs.playerId) continue;
      const size = ctx.obs.round.hands[captain.id]?.length ?? 8;
      if (size <= 2) value += 22;
      else if (size <= 4) value += 12;
      else if (size <= 6) value += 4;
    }
    if (ctx.hand.length <= 2) value -= 15;
    return value;
  },
};

/**
 * Module Theta (Go-out) Trail Momentum: first personal trail to length ≥ 5
 * earns an extra turn once/sector — push own-trail charts when close.
 */
const trailMomentum: WarpHeuristic = {
  id: H.trailMomentum,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (ctx.obs.objective !== 'go-out') return 0;
    if (!ctx.obs.modules.longestTrail.enabled) return 0;
    if (ctx.obs.trailMomentumClaimedBy != null) return 0;

    const playerId = ctx.obs.playerId;
    const ownLen =
      ctx.obs.round.table.warpTrails[trailKeyFor(ctx.obs.round, playerId)]
        ?.tiles.length ?? 0;

    if (action.kind === 'chart') {
      if (!routeIsOwnTrail(ctx.obs.round, playerId, action.move.route)) {
        if (ownLen >= 3 && ownLen < 5) return -8;
        return 0;
      }
      if (ownLen >= 4 && ownLen < 5) return 40;
      if (ownLen >= 3 && ownLen < 5) return 22;
      if (ownLen < 3) return 6;
      return 0;
    }

    if (action.kind === 'spool') {
      const route = action.option.route;
      if (
        route.kind === 'warp-trail' &&
        routeIsOwnTrail(ctx.obs.round, playerId, route)
      ) {
        if (ownLen >= 3 && ownLen < 5) return 28;
        return 8;
      }
    }

    return 0;
  },
};

/**
 * Module Delta Hot Potato: holding the hazard marker makes PASS painful
 * (points: +5 per pass; go-out: draw 2). Prefer charting / spooling instead.
 */
const hotPotatoPass: WarpHeuristic = {
  id: H.hotPotatoPass,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'pass-turn') return 0;
    if (!ctx.obs.modules.warpDriveSpool.enabled) return 0;
    if (ctx.obs.round.hazardMarkerHolder !== ctx.obs.playerId) return 0;
    return ctx.obs.objective === 'go-out' ? -55 : -35;
  },
};

/**
 * Module Kappa: Temporal Inversion - on even rounds, scoring inverts (highest wins).
 * Strategy: maintain medium hand size (~30-50 pips), avoid going out, prefer drawing.
 */
const temporalInversionStrategy: WarpHeuristic = {
  id: H.temporalInversion,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    const temporalInversion = ctx.obs.modules?.temporalInversion?.enabled ?? false;
    if (!temporalInversion) return 0;
    // Go-out Kappa is Hand Exchange, not pip inversion.
    if (ctx.obs.objective === 'go-out') return 0;
    
    const isInvertedRound = ctx.obs.round.roundNumber % 2 === 0;
    if (!isInvertedRound) return 0;
    
    const currentHandPips = ctx.hand.reduce((sum, coord) => sum + coordinatePipValue(coord), 0);
    const targetPips = 40; // Target ~40 pips for medium hand
    
    // Draw action: encourage drawing on inverted rounds to build hand
    if (action.kind === 'draw') {
      if (currentHandPips < targetPips) {
        return 30; // Strong bonus for drawing when hand is small
      }
      if (currentHandPips < 55) {
        return 15; // Moderate bonus for drawing when hand is medium
      }
      return -5; // Small penalty if hand is already large
    }
    
    // Chart action: prefer LOW-pip plays on inverted rounds (keep the high pips!)
    if (action.kind === 'chart') {
      const pipValue = coordinatePipValue(action.move.coordinate);
      const tilesAfter = ctx.hand.length - 1;
      const pipsAfter = currentHandPips - pipValue;
      
      // Going out empties your hand — the maximum penalty on an inverted round.
      // Flag it decisively so the advisor never rates the go-out as a good line.
      if (tilesAfter === 0) {
        return -300;
      }
      
      // Penalize plays that would leave us with very few pips
      if (pipsAfter < 25 && tilesAfter > 0) {
        return -25; // Strong penalty - we're dumping too many pips!
      }
      
      // Bonus for playing low-value tiles (0-6 pips)
      if (pipValue <= 6) {
        return 8;
      }
      
      // Moderate penalty for playing medium tiles (7-15 pips)  
      if (pipValue <= 15) {
        return -3;
      }
      
      // Strong penalty for playing high-value tiles (16+ pips)
      return -10;
    }
    
    return 0;
  },
};

/**
 * Module Kappa (Go-out) Hand Exchange: choose which tile to give back after
 * the random steal. Prefer high-pip tiles that do not match open ends.
 */
const handExchangeGiveback: WarpHeuristic = {
  id: H.handExchangeGiveback,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'resolve-hand-exchange') return 0;
    if (ctx.obs.objective !== 'go-out') return 0;
    if (!ctx.obs.modules.temporalInversion.enabled) return 0;
    return scoreHandExchangeGiveback(action.coordinate, ctx.obs);
  },
};

/**
 * Module Theta: Longest Trail Bonus - captain with longest trail gets -3 at round end.
 * Strategy: value own-trail plays higher, especially when behind in length or in late game.
 */
const longestTrailBonus: WarpHeuristic = {
  id: H.longestTrailBonus,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    const longestTrail = ctx.obs.modules?.longestTrail?.enabled ?? false;
    if (!longestTrail) return 0;
    if (action.kind !== 'chart') return 0;
    if (ctx.obs.objective === 'go-out') return 0; // Only relevant for points campaigns
    
    const route = action.move.route;
    const playerId = ctx.obs.playerId;
    const onOwnTrail = routeIsOwnTrail(ctx.obs.round, playerId, route);
    
    if (!onOwnTrail) return 0;
    
    // Calculate trail lengths (dedupe opponents sharing a squad trail)
    const ownTrailKey = trailKeyFor(ctx.obs.round, playerId);
    const ownTrailLen =
      ctx.obs.round.table.warpTrails[ownTrailKey]?.tiles.length ?? 0;
    let maxOpponentTrailLen = 0;
    const seenTrailKeys = new Set([ownTrailKey]);
    for (const captain of ctx.obs.captains) {
      if (captain.id === playerId) continue;
      const trailKey = trailKeyFor(ctx.obs.round, captain.id);
      if (seenTrailKeys.has(trailKey)) continue;
      seenTrailKeys.add(trailKey);
      const oppLen = ctx.obs.round.table.warpTrails[trailKey]?.tiles.length ?? 0;
      maxOpponentTrailLen = Math.max(maxOpponentTrailLen, oppLen);
    }
    
    // Early game: moderate bonus for building trail
    const unchartedCount = ctx.obs.round.unchartedSectors.length;
    const lateGame = unchartedCount < 15;
    
    let value = 5; // Base bonus for own trail play
    
    // Behind in trail length: stronger incentive to catch up
    if (ownTrailLen < maxOpponentTrailLen) {
      value += (maxOpponentTrailLen - ownTrailLen) * 3;
    }
    
    // Leading in trail length: maintain lead
    if (ownTrailLen > maxOpponentTrailLen) {
      value += 8;
    }
    
    // Late game: aggressive trail building for bonus
    if (lateGame) {
      value += 12;
      
      // Very late game (< 8 tiles left): -3 bonus is worth ~3 good plays
      if (unchartedCount < 8 && ownTrailLen >= maxOpponentTrailLen) {
        value += 15;
      }
    }
    
    return value;
  },
};

/**
 * Module Iota: Double Down - playing a double forces next player to draw 2 tiles.
 * Strategy: time doubles to maximize burden (play when opponent has few tiles).
 */
const doubleDownTiming: WarpHeuristic = {
  id: H.doubleDownTiming,
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    const doubleDown = ctx.obs.modules?.doubleDown?.enabled ?? false;
    if (!doubleDown) return 0;
    if (action.kind !== 'chart') return 0;
    if (!isDouble(action.move.coordinate)) return 0;
    
    // Find next player's hand size
    const captains = ctx.obs.captains;
    const myIndex = captains.findIndex(c => c.id === ctx.obs.playerId);
    if (myIndex === -1) return 0;
    
    const nextIndex = (myIndex + 1) % captains.length;
    const nextPlayer = captains[nextIndex];
    const nextHandSize = nextPlayer ? (ctx.obs.round.hands[nextPlayer.id]?.length ?? 10) : 10;
    
    // Go-out mode: maximize burden on opponents with small hands
    if (ctx.obs.objective === 'go-out') {
      // Opponent has few tiles: great time to burden them!
      if (nextHandSize <= 3) {
        return 25; // Strong bonus - double down is very disruptive
      }
      if (nextHandSize <= 6) {
        return 12; // Moderate bonus
      }
      // Opponent has many tiles: less impact
      return 0;
    }
    
    // Points mode: moderate timing advantage
    if (nextHandSize <= 5) {
      return 8; // Small bonus for good timing
    }
    
    // Early game: slight penalty (don't waste doubles too early)
    const unchartedCount = ctx.obs.round.unchartedSectors.length;
    if (unchartedCount > 40 && nextHandSize > 8) {
      return -5; // Small penalty for early waste
    }
    
    return 0;
  },
};

/**
 * Module Epsilon (Drafting): Prefer doubles during draft.
 * Doubles are universally valuable - they start trails, satisfy spacedock,
 * and create Red Alert pressure/chaos on opponents.
 */
const draftDoubles: WarpHeuristic = {
  id: 'draft-doubles',
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'pick-from-pack') return 0;
    if (!isDouble(action.coordinate)) return 0;
    
    // Doubles are HIGHLY valuable in draft
    const pipValue = coordinatePipValue(action.coordinate);
    
    // High doubles (8-12) are premium - can cause mayhem late game
    if (pipValue >= 16) return 50; // Double-12, double-11, double-10, etc
    
    // Mid doubles (4-7) are flexible connectors
    if (pipValue >= 8) return 40; // Double-7 down to double-4
    
    // Low doubles (0-3) are still useful for variety
    return 30; // Double-3, double-2, double-1, double-0
  },
};

/**
 * Module Epsilon (Drafting): Prefer tiles with common pip values (connectors).
 * Tiles with 5-7 pips connect to more tiles in the set, increasing flexibility.
 */
const draftConnectors: WarpHeuristic = {
  id: 'draft-connectors',
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'pick-from-pack') return 0;
    
    const { low, high } = action.coordinate;
    
    // Count how many tiles this connects to (simplified heuristic)
    // Mid-range values (4-8) appear most frequently in W12 set
    const commonValue = (pip: number): number => {
      if (pip >= 4 && pip <= 8) return 3; // Very common
      if (pip >= 2 && pip <= 10) return 2; // Common
      if (pip >= 0 && pip <= 12) return 1; // Less common
      return 0;
    };
    
    const connectivity = commonValue(low) + commonValue(high);
    return connectivity * 2; // 0-12 bonus range
  },
};

/**
 * Module Epsilon (Drafting): Hand diversity during draft.
 * Prefer tiles that give us coverage across different pip values.
 */
const draftDiversity: WarpHeuristic = {
  id: 'draft-diversity',
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'pick-from-pack') return 0;
    
    const { low, high } = action.coordinate;
    const round = ctx.obs.round;
    
    // During drafting, hand is being built in round.hands[playerId]
    const currentHand = round.hands[ctx.obs.playerId] || [];
    
    // Count unique pip values we already have
    const existingPips = new Set<number>();
    for (const tile of currentHand) {
      existingPips.add(tile.low);
      existingPips.add(tile.high);
    }
    
    // Bonus for adding NEW pip values we don't have yet
    let novelty = 0;
    if (!existingPips.has(low)) novelty += 3;
    if (!existingPips.has(high) && high !== low) novelty += 3;
    
    return novelty;
  },
};

/**
 * Module Epsilon (Drafting): Strategic pip management for points objective.
 * During draft, balance high-pip tiles (to dump) with low-pip safety.
 * This works WITH dumpPips heuristic but considers draft context.
 */
const draftPipBalance: WarpHeuristic = {
  id: 'draft-pip-balance',
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'pick-from-pack') return 0;
    if (ctx.obs.objective === 'go-out') return 0; // Only for points
    
    const round = ctx.obs.round;
    const currentHand = round.hands[ctx.obs.playerId] || [];
    const draftState = round.draftState;
    
    if (!draftState) return 0;
    
    // How far into draft are we?
    const pickNumber = draftState.pickedTiles[ctx.obs.playerId]?.length ?? 0;
    const desiredHandSize = handSizeForPlayerCount(
      ctx.obs.captains.length,
      undefined,
      round.maxPip ?? 12
    );
    const draftProgress = pickNumber / Math.max(1, desiredHandSize);
    
    // Calculate current hand pip average
    let totalPips = 0;
    for (const tile of currentHand) {
      totalPips += coordinatePipValue(tile);
    }
    const avgPips = currentHand.length > 0 ? totalPips / currentHand.length : 8;
    
    const tilePips = coordinatePipValue(action.coordinate);
    
    // Early draft (first 1/3): prefer LOWER pips for safety
    if (draftProgress < 0.33) {
      if (tilePips <= 6) return 8; // Low-pip tiles are safe
      if (tilePips >= 18) return -5; // Avoid very high early
    }
    
    // Mid draft (middle 1/3): balance
    if (draftProgress < 0.67) {
      // If we're pip-heavy, prefer lower; if pip-light, prefer higher
      if (avgPips > 10 && tilePips <= 8) return 6;
      if (avgPips < 7 && tilePips >= 14) return 6;
    }
    
    // Late draft (final 1/3): grab remaining high-value targets
    // At this point dumpPips heuristic handles most of it
    return 0;
  },
};

/**
 * Module Epsilon (Drafting): Go-out tile count strategy.
 * For go-out objective, prefer tiles that maximize playability.
 */
const draftGoOutTiles: WarpHeuristic = {
  id: 'draft-go-out',
  score(action: WarpAiAction, ctx: WarpEvalContext): number {
    if (action.kind !== 'pick-from-pack') return 0;
    if (ctx.obs.objective !== 'go-out') return 0;
    
    const { low, high } = action.coordinate;
    
    // For go-out, we want tiles that play easily (mid-range connectors)
    // and avoid high-pip "anchors"
    
    // Doubles are still great (can start/satisfy)
    if (isDouble(action.coordinate)) return 15;
    
    // Mid-range non-doubles connect well
    const avgPip = (low + high) / 2;
    if (avgPip >= 4 && avgPip <= 8) return 10; // Sweet spot
    if (avgPip >= 2 && avgPip <= 10) return 5; // OK
    
    // Very high tiles (11-12) are risky in go-out
    if (low >= 10 || high >= 10) return -3;
    
    return 0;
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
  continuum,
  dropToImpulseDeclare,
  dropToImpulseCatch,
  dropToImpulseForget,
  spoolStrategy,
  hotPotatoPass,
  salamanderSurge,
  trailMomentum,
  temporalInversionStrategy,
  handExchangeGiveback,
  longestTrailBonus,
  doubleDownTiming,
  squadCoordination,
  // Drafting heuristics (Module Epsilon)
  draftDoubles,
  draftConnectors,
  draftDiversity,
  draftPipBalance,
  draftGoOutTiles,
];
