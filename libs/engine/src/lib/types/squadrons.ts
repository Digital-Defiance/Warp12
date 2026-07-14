import type { PlayerId } from './player.js';

/**
 * Module Zeta: a squadron (team) of captains sharing one Warp Trail and one
 * Distress Beacon.
 *
 * Model C trail sharing: rather than re-keying the whole `warpTrails` record by
 * a synthetic trail id, each squad designates one member's id as the
 * **canonical trail key**. Every member's plays and beacon reads/writes route
 * through `trailKey`, so the squad shares a single trail entry in
 * `TableState.warpTrails`. In non-squad (FFA) games there are no squadrons and
 * every captain is their own trail key (identity), so behavior is unchanged.
 */
export interface Squadron {
  readonly id: string;
  readonly memberIds: readonly PlayerId[];
  /**
   * The member id whose `warpTrails[...]` entry the whole squad shares. Chosen
   * deterministically as the first member id (also drives round-starter and
   * serialization stability).
   */
  readonly trailKey: PlayerId;
  /**
   * Host-chosen display name (e.g. "Away Team"). Falls back to "Squad N"
   * (1-indexed, formation order) wherever displayed when unset.
   */
  readonly name?: string;
}
