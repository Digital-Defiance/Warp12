import type { RatedObjective } from './rated-match-schema.js';
import type { RulesProfileId } from './rules-profile.js';
import type {
  CharterHouseRulesConfig,
  CharterModulesConfig,
} from './charter-lobby-config.js';

export type CharterMemberRole = 'owner' | 'member';

export interface CharterDocument {
  charterId: string;
  slug: string;
  name: string;
  rulesProfileId: RulesProfileId;
  objective: RatedObjective;
  playerCount: number;
  campaignRounds: number;
  /** Frozen module toggles for every rated game under this charter. */
  modules?: CharterModulesConfig;
  /** Frozen house rules for every rated game under this charter. */
  houseRules?: CharterHouseRulesConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberUids: string[];
  /** SHA-256 hex of the active invite token (private crews). */
  inviteTokenHash?: string;
  /** Short handoff code (display as CREW-XXXX). Unique; rotatable. */
  inviteCodeShort?: string;
  /** Discoverable on /crews; join via owner-approved request. */
  listed?: boolean;
  /** Open ladder — anyone verified may join; also updates global human TEI when rated. */
  isGlobalOfficial?: boolean;
  /** Display season for Global Official (e.g. `2026 Spring`). */
  seasonLabel?: string;
  /** Machine season id (e.g. `2026-spring`) — group TEI buckets roll on change. */
  seasonKey?: string;
}

export interface CharterMemberDocument {
  charterId: string;
  uid: string;
  role: CharterMemberRole;
  displayName: string;
  joinedAt: string;
}

export interface GroupTeiStats {
  goOut?: import('./rated-match-schema.js').ObjectiveTeiStats;
  points?: import('./rated-match-schema.js').ObjectiveTeiStats;
  /** Active season bucket — mismatched keys read as empty (soft reset). */
  seasonKey?: string;
}

export type GroupTeiByCharter = Record<string, GroupTeiStats>;

export function groupRatedClaimId(
  charterId: string,
  eventId: string,
  seasonKey?: string
): string {
  if (seasonKey) {
    return `${charterId}:${seasonKey}:${eventId}`;
  }
  return `${charterId}:${eventId}`;
}

export function parseGroupRatedClaimId(
  claim: string
): { charterId: string; seasonKey?: string; eventId: string } | null {
  const parts = claim.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { charterId: parts[0], eventId: parts[1] };
  }
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return { charterId: parts[0], seasonKey: parts[1], eventId: parts[2] };
  }
  return null;
}

export function normalizeCharterSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function generateCrewInviteToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return suffix;
}

const CREW_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCrewInviteCodeShort(): string {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += CREW_CODE_ALPHABET[Math.floor(Math.random() * CREW_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeCrewInviteCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.startsWith('CREW-')) {
    return trimmed.slice(5);
  }
  if (trimmed.startsWith('CREW')) {
    return trimmed.slice(4);
  }
  return trimmed;
}

export function formatCrewInviteCode(short: string): string {
  return `CREW-${short}`;
}

export type CharterJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CharterJoinRequestDocument {
  charterId: string;
  uid: string;
  displayName: string;
  requestedAt: string;
  status: CharterJoinRequestStatus;
  resolvedAt?: string;
  resolvedBy?: string;
}
