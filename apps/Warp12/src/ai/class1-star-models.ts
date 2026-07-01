import {
  CLASS1_STAR_DISPLAY_NAME,
  CLASS1_STAR_FEATURE_DIM,
  type Class1StarModelWeights,
  type Class1StarResidualScorer,
} from 'warp12-engine';

/** Relative to Vite `base` — lazy-loaded on first Class I* match. */
export const CLASS1_STAR_ONNX_URL = '/models/class1-star-v1.onnx';

export const CLASS1_STAR_WEIGHTS_URL = '/models/class1-star-v1.json';

export const CLASS1_STAR_MODEL_INPUT = 'features';

export const CLASS1_STAR_MODEL_OUTPUT = 'residual';

export { CLASS1_STAR_DISPLAY_NAME, CLASS1_STAR_FEATURE_DIM };

export type { Class1StarModelWeights, Class1StarResidualScorer };
