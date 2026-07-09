import type { WarpAiAction } from './actions.js';
import { coordinateKey } from '../types/coordinate.js';
import {
  ACTION_KIND_INDEX,
  CLASS1_STAR_ACTION_KIND_DIM,
  CLASS1_STAR_ROUTE_KIND_DIM,
  tileIndexForKey,
} from './class1-star-constants.js';
import {
  ADVISOR_ACTION_FEATURE_DIM,
  ADVISOR_POLICY_FEATURE_DIM,
  ADVISOR_STATE_CONCEPT_DIM,
} from './advisor-constants.js';
import { computeAdvisorStateConcepts } from './advisor-concepts.js';
import { connectingValueForRoute } from './context.js';
import type { WarpEvalContext } from './context.js';

function routeKindIndex(
  route: Extract<WarpAiAction, { kind: 'chart' }>['move']['route']
): number {
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

export function encodeAdvisorActionFeatures(
  ctx: WarpEvalContext,
  action: WarpAiAction,
  out: Float32Array = new Float32Array(ADVISOR_ACTION_FEATURE_DIM)
): Float32Array {
  if (out.length !== ADVISOR_ACTION_FEATURE_DIM) {
    throw new Error(
      `Advisor action buffer length ${out.length} != ${ADVISOR_ACTION_FEATURE_DIM}.`
    );
  }
  out.fill(0);
  let cursor = 0;
  out[cursor + ACTION_KIND_INDEX[action.kind]] = 1;
  cursor += CLASS1_STAR_ACTION_KIND_DIM;

  if (action.kind === 'chart') {
    out[cursor + routeKindIndex(action.move.route)] = 1;
    cursor += CLASS1_STAR_ROUTE_KIND_DIM;
    const tileIndex = tileIndexForKey(coordinateKey(action.move.coordinate));
    out[cursor++] = tileIndex !== undefined ? tileIndex / 91 : 0;
    out[cursor++] = action.move.coordinate.low / 12;
    out[cursor++] = action.move.coordinate.high / 12;
    const open = connectingValueForRoute(ctx.obs.round, action.move.route);
    out[cursor++] = open !== null ? open / 12 : 0;
    out[cursor++] = 1;
  } else {
    cursor += CLASS1_STAR_ROUTE_KIND_DIM + 5;
  }

  if (cursor !== ADVISOR_ACTION_FEATURE_DIM) {
    throw new Error(
      `Advisor action encoder drift: wrote ${cursor}, expected ${ADVISOR_ACTION_FEATURE_DIM}.`
    );
  }
  return out;
}

export function encodeAdvisorPolicyFeatures(
  ctx: WarpEvalContext,
  action: WarpAiAction,
  out: Float32Array = new Float32Array(ADVISOR_POLICY_FEATURE_DIM)
): Float32Array {
  if (out.length !== ADVISOR_POLICY_FEATURE_DIM) {
    throw new Error(
      `Advisor policy buffer length ${out.length} != ${ADVISOR_POLICY_FEATURE_DIM}.`
    );
  }
  const concepts = computeAdvisorStateConcepts(ctx);
  out.set(concepts, 0);
  const actionFeatures = encodeAdvisorActionFeatures(ctx, action);
  out.set(actionFeatures, ADVISOR_STATE_CONCEPT_DIM);
  return out;
}

export function encodeAdvisorPolicyFeatureBatch(
  ctx: WarpEvalContext,
  actions: readonly WarpAiAction[]
): Float32Array[] {
  return actions.map((action) => encodeAdvisorPolicyFeatures(ctx, action));
}
