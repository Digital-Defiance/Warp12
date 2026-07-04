import type { WarpAiAction } from './actions.js';
import type { WarpEvalContext } from './context.js';
import { encodeClass1StarFeatures } from './feature-encoder.js';
import { OMEGA_STATE_FEATURE_DIM } from './omega-constants.js';

/**
 * Per-(state, action) policy features. Reuses the battle-tested Class I* encoder
 * so the exact same bytes are produced in Node, browser, and training export.
 */
export function encodeOmegaPolicyFeatures(
  ctx: WarpEvalContext,
  action: WarpAiAction
): Float32Array {
  return encodeClass1StarFeatures(ctx, action);
}

export function encodeOmegaPolicyFeatureBatch(
  ctx: WarpEvalContext,
  actions: readonly WarpAiAction[]
): Float32Array[] {
  return actions.map((action) => encodeClass1StarFeatures(ctx, action));
}

/**
 * Action-independent state features for the value head. The first
 * {@link OMEGA_STATE_FEATURE_DIM} slots of the policy vector (context + hand mask
 * + placed mask) are identical for any action, so we encode with a no-op action
 * and slice the state prefix. This guarantees the value head sees the same state
 * representation the policy head does, with zero encoder drift.
 */
export function encodeOmegaStateFeatures(ctx: WarpEvalContext): Float32Array {
  const full = encodeClass1StarFeatures(ctx, { kind: 'draw' });
  return full.slice(0, OMEGA_STATE_FEATURE_DIM);
}
