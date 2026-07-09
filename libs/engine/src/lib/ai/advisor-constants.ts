import {
  CLASS1_STAR_ACTION_KIND_DIM,
  CLASS1_STAR_ROUTE_KIND_DIM,
} from './class1-star-constants.js';

/** Portable JSON schema version for the concept-bottleneck advisor. */
export const ADVISOR_MODEL_VERSION = 1;

/** Named, state-derived concept scalars (engine supervision + explanations). */
export const ADVISOR_STATE_CONCEPT_DIM = 20;

/** Compact per-action encoding (kind, route, tile cues). */
export const ADVISOR_ACTION_FEATURE_DIM =
  CLASS1_STAR_ACTION_KIND_DIM + CLASS1_STAR_ROUTE_KIND_DIM + 5;

/** Policy head input = state concepts + action features. */
export const ADVISOR_POLICY_FEATURE_DIM =
  ADVISOR_STATE_CONCEPT_DIM + ADVISOR_ACTION_FEATURE_DIM;

export const ADVISOR_DISPLAY_NAME = 'Tactical Advisor';
