/**
 * Determines what level of comms is allowed at any given point in a sector.
 * Rated sectors restrict comms to quick-phrase hails during active play.
 *
 * Module Zeta: the table channel keeps that restriction (prevents collusion
 * across opposing squads), but the squad channel is always full — the rules
 * (RULES.tex "Collaborative Command") explicitly allow squadmates to discuss
 * strategy. This is an honor-system boundary (talk strategy, never paste raw
 * hand contents), same posture as the advisor rules.
 */

import type { GamePhase } from 'warp12-engine';

export type CommsMode = 'full' | 'quick-only';
export type CommsChannel = 'table' | 'squad';

/**
 * Returns the effective comms mode based on sector rated state, game phase,
 * and channel. Defaults `channel` to `'table'` for existing (non-squad) call
 * sites — no behavior change for FFA games.
 *
 * - **full:** free-form text, DMs, and quick phrases are all available.
 * - **quick-only:** only public quick-phrase hails. No text, no DMs.
 *
 * Rule: table channel, rated + active → quick-only. Squad channel → always
 * full (intra-squad coordination is the mechanic, not collusion). Everything
 * else (lobby, unrated, complete) → full.
 */
export function resolveCommsMode(
  rated: boolean,
  phase: GamePhase | 'lobby',
  channel: CommsChannel = 'table'
): CommsMode {
  if (channel === 'squad') {
    return 'full';
  }
  if (rated && phase === 'active') {
    return 'quick-only';
  }
  return 'full';
}
