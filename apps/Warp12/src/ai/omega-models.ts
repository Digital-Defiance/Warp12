import type { GameObjective, OmegaModelWeights } from 'warp12-engine';
import {
  OMEGA_DISPLAY_NAME,
  OMEGA_POLICY_FEATURE_DIM,
} from 'warp12-engine';

/**
 * Shipped Ω weights by objective. Points and go-out are separate champions
 * for Commander play; encoder still one-hots objective inside each net.
 */
export const OMEGA_WEIGHTS_URL_BY_OBJECTIVE: Readonly<
  Record<'points' | 'go-out', string>
> = {
  points: '/models/omega-v1.json',
  'go-out': '/models/omega-goout-v1.json',
};

/** @deprecated Prefer {@link OMEGA_WEIGHTS_URL_BY_OBJECTIVE}.points */
export const OMEGA_WEIGHTS_URL = OMEGA_WEIGHTS_URL_BY_OBJECTIVE.points;

export function omegaWeightsUrlForObjective(
  objective: GameObjective
): string {
  return objective === 'go-out'
    ? OMEGA_WEIGHTS_URL_BY_OBJECTIVE['go-out']
    : OMEGA_WEIGHTS_URL_BY_OBJECTIVE.points;
}

export { OMEGA_DISPLAY_NAME, OMEGA_POLICY_FEATURE_DIM };

export type { OmegaModelWeights };
