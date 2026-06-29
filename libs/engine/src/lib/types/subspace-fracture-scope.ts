import type { ChartRoute } from './actions.js';
import type { PlayerId } from './player.js';

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
  scope: SubspaceFractureScope
): boolean {
  switch (scope) {
    case 'own-trail':
      return route.kind === 'warp-trail' && route.playerId === playerId;
    case 'all-captains':
      return route.kind === 'warp-trail';
    case 'all-doubles':
      return route.kind === 'warp-trail' || route.kind === 'neutral-zone';
  }
}
