/**
 * Ban / ops document shapes. Written only via Admin SDK (Functions or `yarn warp`).
 *
 * One ban record = one subject (“idiot”). It may carry a Firebase uid and/or
 * IPv4 and/or IPv6 — all on the same doc so dual-stack addresses stay linked.
 */

export const BANS_COLLECTION = 'bans';
export const OPS_AUDIT_COLLECTION = 'opsAudit';

/** Explicit dual-stack fields; at least one of uid / ipv4 / ipv6 is set. */
export type BanDocument = {
  /** Firebase Auth uid when known. Empty string for IP-only bans. */
  uid: string;
  /** Document id (same as uid when uid present; otherwise `ip:…`). */
  banId: string;
  active: boolean;
  reason: string;
  bannedAt: unknown;
  bannedBy: string;
  bannedByLabel: string;
  expiresAt: unknown;
  email: string | null;
  displayName: string | null;
  providers: string[];
  anonymous: boolean;
  authDisabled: boolean;
  notes: string | null;
  /**
   * Optional player appeal / response note captured by ops (not a workflow).
   * Distinct from internal `notes`.
   */
  appealNote: string | null;
  /** Normalized IPv4 dotted-quad, or null. */
  ipv4: string | null;
  /** Normalized IPv6 (lowercase), or null. */
  ipv6: string | null;
  /**
   * Lookup keys for `array-contains` queries, e.g. `v4:1.2.3.4`, `v6:2001:db8::1`.
   * Always derived from ipv4/ipv6 — do not edit by hand.
   */
  ipKeys: string[];
  unbannedAt?: unknown;
  unbannedBy?: string;
  unbannedByLabel?: string;
};
