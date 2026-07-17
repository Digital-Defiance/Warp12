import { callFunction } from './functions-client';

export async function muteUser(params: {
  uid: string;
  reason: string;
  days?: number;
  notes?: string;
  mode?: 'hard' | 'shadow';
}): Promise<{ muted: boolean; uid: string; mode?: string }> {
  return callFunction('muteUser', params);
}

export async function unmuteUser(uid: string): Promise<{ muted: boolean }> {
  return callFunction('unmuteUser', { uid });
}

export async function muteInSector(params: {
  gameId: string;
  uid: string;
  reason: string;
  days?: number;
}): Promise<{ muted: boolean }> {
  return callFunction('muteInSector', params);
}

export async function unmuteInSector(
  gameId: string,
  uid: string
): Promise<{ muted: boolean }> {
  return callFunction('unmuteInSector', { gameId, uid });
}

export async function opsKickCaptain(params: {
  gameId: string;
  targetUid: string;
  reason?: string;
}): Promise<{ mode: string; remaining: number }> {
  return callFunction('opsKickCaptain', params);
}

export async function opsTerminateSector(params: {
  gameId: string;
  reason?: string;
  mode?: 'soft' | 'hard';
}): Promise<{ mode: string; deleted?: unknown }> {
  return callFunction('opsTerminateSector', params);
}

export async function listStaleGames(params?: {
  olderThanDays?: number;
  limit?: number;
}): Promise<{
  cutoff: string;
  games: Array<{
    id: string;
    phase: string;
    hostId: string;
    updatedAt: string;
    opsTerminated: boolean;
    captainCount: number;
  }>;
}> {
  return callFunction('listStaleGames', params ?? {});
}

export async function opsCleanupStaleSector(
  gameId: string
): Promise<{ deleted: Record<string, number> }> {
  return callFunction('opsCleanupStaleSector', { gameId });
}

export async function opsDropSpectators(
  gameId: string
): Promise<{ dropped: number }> {
  return callFunction('opsDropSpectators', { gameId });
}

export async function setAllowSpectate(
  gameId: string,
  allow: boolean
): Promise<{ allowSpectate: boolean }> {
  return callFunction('setAllowSpectate', { gameId, allow });
}
