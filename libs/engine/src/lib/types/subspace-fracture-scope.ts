import type { ChartRoute } from './actions.js';
import type { PlayerId } from './player.js';
import type { RoundState } from './game-state.js';
import { sameTrailGroup } from '../engine/squadrons.js';

/** Which doubles may open Subspace Fracture when the module is enabled. */
export type SubspaceFractureScope = 'own-trail' | 'all-captains' | 'all-doubles';

export const DEFAULT_SUBSPACE_FRACTURE_SCOPE: SubspaceFractureScope = 'own-trail';

export const SUBSPACE_FRACTURE_SCOPES: readonly SubspaceFractureScope[] = [
  'own-trail',
  'all-captains',
  'all-doubles',
];

export function subspaceFractureAppliesToDouble(
  route: ChartRoute,
  playerId: PlayerId,
  scope: SubspaceFractureScope,
  round: RoundState
): boolean {
  switch (scope) {
    case 'own-trail':
      // Module Zeta: "own trail" is the shared squad trail — route.playerId
      // is the trail's canonical key, which can differ from a squadmate's
      // own id, so compare via sameTrailGroup rather than direct equality.
      return (
        route.kind === 'warp-trail' &&
        sameTrailGroup(round, playerId, route.playerId)
      );
    case 'all-captains':
      return route.kind === 'warp-trail';
    case 'all-doubles':
      return route.kind === 'warp-trail' || route.kind === 'neutral-zone';
  }
}
