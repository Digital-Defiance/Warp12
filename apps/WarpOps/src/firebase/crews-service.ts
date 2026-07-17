import { callFunction } from './functions-client';

export type CharterSummary = {
  charterId: string;
  name: string;
  slug: string;
  createdBy: string;
  memberCount: number;
  listed: boolean;
  isGlobalOfficial: boolean;
  objective: string;
  playerCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CharterMember = {
  uid: string;
  role: 'owner' | 'member';
  displayName: string;
  joinedAt: string;
};

export type CharterJoinRequest = {
  uid: string;
  displayName: string;
  requestedAt: string;
};

export async function opsListCharters(
  search = '',
  limit = 100
): Promise<{ charters: CharterSummary[]; scanned: number }> {
  return callFunction('opsListCharters', { search, limit });
}

export async function opsGetCharter(charterId: string): Promise<{
  charter: CharterSummary;
  members: CharterMember[];
  pendingRequests: CharterJoinRequest[];
}> {
  return callFunction('opsGetCharter', { charterId });
}

export async function opsRemoveCharterMember(input: {
  charterId: string;
  targetUid: string;
  reason?: string;
}): Promise<{ ok: true; removed: boolean }> {
  return callFunction('opsRemoveCharterMember', input);
}

export async function opsClearCharterJoinRequests(input: {
  charterId: string;
  reason?: string;
}): Promise<{ ok: true; cleared: number }> {
  return callFunction('opsClearCharterJoinRequests', input);
}

export async function opsCloseCharter(input: {
  charterId: string;
  reason?: string;
}): Promise<{ ok: true; closed: boolean }> {
  return callFunction('opsCloseCharter', input);
}

export async function resetGlobalOfficialSeason(input: {
  seasonLabel: string;
  seasonKey?: string;
  playerCounts?: number[];
}): Promise<{ ok: true }> {
  return callFunction('resetGlobalOfficialSeason', input);
}
