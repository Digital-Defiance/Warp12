import type { RatedObjective } from './rated-match-schema';
import type { RulesProfileId } from './rules-profile';
import type {
  CharterHouseRulesConfig,
  CharterModulesConfig,
} from './charter-lobby-config';

export type CharterMemberRole = 'owner' | 'member';

export interface CharterDocument {
  charterId: string;
  slug: string;
  name: string;
  rulesProfileId: RulesProfileId;
  objective: RatedObjective;
  playerCount: number;
  campaignRounds: number;
  modules?: CharterModulesConfig;
  houseRules?: CharterHouseRulesConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberUids: string[];
  inviteTokenHash?: string;
  inviteCodeShort?: string;
  listed?: boolean;
  isGlobalOfficial?: boolean;
  seasonLabel?: string;
  seasonKey?: string;
}

export interface CharterMemberDocument {
  charterId: string;
  uid: string;
  role: CharterMemberRole;
  displayName: string;
  joinedAt: string;
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

export interface GroupTeiStats {
  goOut?: import('./rated-match-schema').ObjectiveRatingStats;
  points?: import('./rated-match-schema').ObjectiveRatingStats;
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

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCrewInviteToken(): string {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return suffix;
}

export function generateCrewInviteCodeShort(): string {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
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
