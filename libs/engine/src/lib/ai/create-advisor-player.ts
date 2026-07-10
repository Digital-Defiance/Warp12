import { chooseActionIndex, type Rng } from 'double-eighteen';

import type { WarpAiAction } from './actions.js';
import {
  computeAdvisorStateConcepts,
  explainAdvisorConcepts,
} from './advisor-concepts.js';
import { encodeAdvisorPolicyFeatureBatch } from './advisor-encoder.js';
import {
  forwardAdvisorPolicyBatch,
  type AdvisorModelWeights,
} from './advisor-net.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { buildWarpContext } from './context.js';
import type { WarpAiObservation } from './observation.js';
import { getAdvisorSkillProfile } from './skill.js';

export interface AdvisorDecision {
  readonly action: WarpAiAction;
  readonly reasons: readonly string[];
}

export interface CreateAdvisorPlayerOptions {
  readonly weights: AdvisorModelWeights;
  readonly rng?: Rng;
}

export interface AdvisorPlayer {
  decide(observation: WarpAiObservation): AdvisorDecision | null;
}

/**
 * Concept-bottleneck advisor (phase B): scores candidates with a net trained to
 * agree with Class Ω / Ω+ teachers; explanations come from active state concepts.
 */
export function createAdvisorPlayer(
  options: CreateAdvisorPlayerOptions
): AdvisorPlayer {
  const rng = options.rng ?? (() => 0.5);
  const weights = options.weights;

  return {
    decide(observation: WarpAiObservation): AdvisorDecision | null {
      const candidates = warpCandidateGenerator(observation);
      if (candidates.length === 0) {
        return null;
      }
      const skill = getAdvisorSkillProfile(
        observation.objective,
        observation.captains.length
      );
      const ctx = buildWarpContext(observation, rng);
      const concepts = computeAdvisorStateConcepts(ctx);
      const features = encodeAdvisorPolicyFeatureBatch(ctx, candidates);
      const logits = forwardAdvisorPolicyBatch(features, weights);
      const index = chooseActionIndex([...logits], skill, rng);
      const action = candidates[index] ?? candidates[0];
      return {
        action,
        reasons: explainAdvisorConcepts(Array.from(concepts), { maxReasons: 4 }),
      };
    },
  };
}
