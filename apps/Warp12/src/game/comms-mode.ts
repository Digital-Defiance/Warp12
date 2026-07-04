/**
 * Determines what level of comms is allowed at any given point in a sector.
 * Rated sectors restrict comms to quick-phrase hails during active play.
 */

import type { GamePhase } from 'warp12-engine';

export type CommsMode = 'full' | 'quick-only';

/**
 * Returns the effective comms mode based on sector rated state and game phase.
 *
 * - **full:** free-form text, DMs, and quick phrases are all available.
 * - **quick-only:** only public quick-phrase hails. No text, no DMs.
 *
 * Rule: rated + active → quick-only. Everything else (lobby, unrated, complete) → full.
 */
export function resolveCommsMode(
  rated: boolean,
  phase: GamePhase | 'lobby'
): CommsMode {
  if (rated && phase === 'active') {
    return 'quick-only';
  }
  return 'full';
}
