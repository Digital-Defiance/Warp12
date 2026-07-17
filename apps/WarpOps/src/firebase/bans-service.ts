import { callFunction } from './functions-client';

export type BanRecord = {
  uid: string;
  banId?: string;
  active: boolean;
  reason: string;
  bannedBy: string;
  bannedByLabel: string;
  email: string | null;
  displayName: string | null;
  providers: string[];
  anonymous: boolean;
  authDisabled: boolean;
  notes: string | null;
  appealNote?: string | null;
  ipv4?: string | null;
  ipv6?: string | null;
  ipKeys?: string[];
  expiresAt?: { seconds?: number; _seconds?: number } | null;
};

export async function banUser(input: {
  uid?: string;
  ipv4?: string | null;
  ipv6?: string | null;
  reason: string;
  expiresAtMs?: number | null;
  notes?: string | null;
  appealNote?: string | null;
  disableAuth?: boolean;
}): Promise<void> {
  await callFunction('banUser', input);
}

export async function unbanUser(input: {
  uid?: string;
  banId?: string;
  reenableAuth?: boolean;
}): Promise<void> {
  await callFunction('unbanUser', input);
}

export async function getBan(input: {
  uid?: string;
  banId?: string;
  ipv4?: string;
  ipv6?: string;
}): Promise<{
  ban: BanRecord | null;
  banned: boolean;
}> {
  return callFunction('getBan', input);
}

export async function listBans(input?: {
  activeOnly?: boolean;
  limit?: number;
}): Promise<{ bans: BanRecord[] }> {
  return callFunction('listBans', input ?? {});
}
