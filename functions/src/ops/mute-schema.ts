/**
 * Global mute docs — Admin SDK only (Functions / `yarn warp`).
 * Lighter than a ban: blocks Subspace message creates, does not disable Auth.
 */

import { OPS_AUDIT_COLLECTION } from './ban-schema';

export { OPS_AUDIT_COLLECTION };

export const MUTES_COLLECTION = 'mutes';

export type MuteDocument = {
  uid: string;
  active: boolean;
  reason: string;
  mutedAt: unknown;
  mutedBy: string;
  mutedByLabel: string;
  /** Firestore Timestamp or null (permanent until unmuted). */
  expiresAt: unknown;
  notes: string | null;
  /**
   * hard (default): block message creates.
   * shadow: accepts writes but hides from other captains (ops review tool).
   */
  mode?: 'hard' | 'shadow';
  unmutedAt?: unknown;
  unmutedBy?: string;
  unmutedByLabel?: string;
};

/** Per-sector mute under `games/{gameId}/mutes/{uid}`. */
export type SectorMuteDocument = {
  uid: string;
  gameId: string;
  active: boolean;
  reason: string;
  mutedAt: unknown;
  mutedBy: string;
  mutedByLabel: string;
  expiresAt: unknown;
  notes: string | null;
  mode?: 'hard' | 'shadow';
};
