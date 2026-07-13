import {
  CLASS1_STAR_CONTEXT_DIM,
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_FEATURE_DIM_V0,
  CLASS1_STAR_TILE_COUNT,
} from './class1-star-constants.js';

/**
 * Ω ("Omega") — the standalone self-play policy/value network.
 *
 * Unlike Class I* (a learned residual bolted onto Commander heuristics), Omega
 * is trained purely by self-play with the game outcome as the only reward. It
 * has no Commander target anywhere in its pipeline. The tactical advisor uses a
 * separate concept-bottleneck model (phase B) distilled from Ω+ search labels.
 */
export const OMEGA_DISPLAY_NAME = 'Ω';

/** Short label for compact UI (mirrors `I*`). */
export const OMEGA_SHORT_DISPLAY_NAME = 'Ω';

export const OMEGA_MODEL_VERSION = 1;

/**
 * Policy features are the full per-(state, action) vector — identical schema to
 * the Class I* encoder (context + hand mask + placed mask + action encoding).
 * Current schema (v1) uses 304 dims; legacy v0 used 303 (before spool action).
 */
export const OMEGA_POLICY_FEATURE_DIM = CLASS1_STAR_FEATURE_DIM;

/** Legacy Omega models trained on v0 schema (303 dims, before spool). */
export const OMEGA_POLICY_FEATURE_DIM_V0 = CLASS1_STAR_FEATURE_DIM_V0;

/**
 * Value features are the action-independent state prefix of the policy vector:
 * context + hand mask + placed mask. The value head must not see a candidate
 * action, so it consumes only this slice.
 */
export const OMEGA_STATE_FEATURE_DIM =
  CLASS1_STAR_CONTEXT_DIM + CLASS1_STAR_TILE_COUNT * 2;
