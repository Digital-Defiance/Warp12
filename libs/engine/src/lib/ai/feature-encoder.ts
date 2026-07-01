import { coordinateKey } from '../types/coordinate.js';
import type { ChartRoute } from '../types/actions.js';
import {
  ACTION_KIND_INDEX,
  CLASS1_STAR_ACTION_KIND_DIM,
  CLASS1_STAR_CONTEXT_DIM,
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_ROUTE_KIND_DIM,
  CLASS1_STAR_TILE_COUNT,
  RACE_PHASE_INDEX,
  tileIndexForKey,
} from './class1-star-constants.js';
import { collectPlacedCoordinates } from './context.js';
import type { WarpAiAction } from './actions.js';
import type { WarpEvalContext } from './context.js';

function writeTileMask(
  out: Float32Array,
  offset: number,
  coordinates: readonly { readonly low: number; readonly high: number }[]
): void {
  for (const coordinate of coordinates) {
    const index = tileIndexForKey(coordinateKey(coordinate));
    if (index !== undefined) {
      out[offset + index] = 1;
    }
  }
}

function routeKindIndex(route: ChartRoute): number {
  switch (route.kind) {
    case 'warp-trail':
      return 0;
    case 'red-alert-cover':
      return 1;
    case 'neutral-zone':
      return 2;
    case 'fracture-stabilizer':
      return 3;
  }
}

function opponentHandStats(
  ctx: WarpEvalContext
): { min: number; max: number; avg: number } {
  const { obs } = ctx;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  let total = 0;
  let opponents = 0;

  for (const captain of obs.captains) {
    if (captain.id === obs.playerId) continue;
    const count = (obs.round.hands[captain.id] ?? []).length;
    min = Math.min(min, count);
    max = Math.max(max, count);
    total += count;
    opponents++;
  }

  if (opponents === 0) {
    return { min: 0, max: 0, avg: 0 };
  }

  return { min, max, avg: total / opponents };
}

/**
 * Deterministic fixed-width encoder for Class I* residual models.
 * Same bytes in Node, browser, and training export pipelines.
 */
export function encodeClass1StarFeatures(
  ctx: WarpEvalContext,
  action: WarpAiAction,
  out: Float32Array = new Float32Array(CLASS1_STAR_FEATURE_DIM)
): Float32Array {
  if (out.length !== CLASS1_STAR_FEATURE_DIM) {
    throw new Error(
      `Expected feature buffer length ${CLASS1_STAR_FEATURE_DIM}; got ${out.length}.`
    );
  }

  out.fill(0);
  const { obs } = ctx;
  const round = obs.round;
  let cursor = 0;

  out[cursor + (obs.objective === 'go-out' ? 1 : 0)] = 1;
  cursor += 2;

  const playerCount = Math.max(1, obs.captains.length);
  const handSize = ctx.hand.length;
  const pileSize = round.unchartedSectors.length;
  const opp = opponentHandStats(ctx);

  out[cursor++] = playerCount / 8;
  out[cursor++] = handSize / 13;
  out[cursor++] = pileSize / CLASS1_STAR_TILE_COUNT;
  out[cursor++] = round.spacedockValue / 12;
  out[cursor++] = opp.min / 13;
  out[cursor++] = opp.max / 13;
  out[cursor++] = opp.avg / 13;

  if (obs.objective === 'go-out') {
    out[cursor + RACE_PHASE_INDEX[ctx.goOutRacePhase]] = 1;
  }
  cursor += 3;

  const activeIndex = round.turnOrder.indexOf(obs.playerId);
  out[cursor++] = activeIndex >= 0 ? activeIndex / Math.max(1, playerCount - 1) : 0;

  if (cursor !== CLASS1_STAR_CONTEXT_DIM) {
    throw new Error(
      `Class I* context encoder drift: wrote ${cursor}, expected ${CLASS1_STAR_CONTEXT_DIM}.`
    );
  }

  writeTileMask(out, cursor, ctx.hand);
  cursor += CLASS1_STAR_TILE_COUNT;

  writeTileMask(out, cursor, collectPlacedCoordinates(round.table));
  cursor += CLASS1_STAR_TILE_COUNT;

  const kindIndex = ACTION_KIND_INDEX[action.kind];
  out[cursor + kindIndex] = 1;
  cursor += CLASS1_STAR_ACTION_KIND_DIM;

  if (action.kind === 'chart') {
    writeTileMask(out, cursor, [action.move.coordinate]);
    cursor += CLASS1_STAR_TILE_COUNT;

    out[cursor + routeKindIndex(action.move.route)] = 1;
    cursor += CLASS1_STAR_ROUTE_KIND_DIM;

    out[cursor++] = action.move.coordinate.low / 12;
    out[cursor++] = action.move.coordinate.high / 12;
  } else {
    cursor += CLASS1_STAR_TILE_COUNT + CLASS1_STAR_ROUTE_KIND_DIM + 2;
  }

  if (cursor !== CLASS1_STAR_FEATURE_DIM) {
    throw new Error(
      `Class I* feature encoder drift: wrote ${cursor}, expected ${CLASS1_STAR_FEATURE_DIM}.`
    );
  }

  return out;
}

/** Encode a batch of candidates sharing one observation context. */
export function encodeClass1StarFeatureBatch(
  ctx: WarpEvalContext,
  actions: readonly WarpAiAction[]
): Float32Array[] {
  return actions.map((action) => encodeClass1StarFeatures(ctx, action));
}
