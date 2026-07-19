import { callFunction } from './functions-client.js';
import type { WarpSkillLevel } from 'warp12-engine';

export async function hostReplaceCaptainWithAi(
  gameId: string,
  targetUid: string,
  skill: WarpSkillLevel = 'lieutenant'
): Promise<{ ok: boolean; aiId: string; displayName: string; skill: string }> {
  return callFunction('hostReplaceCaptainWithAi', {
    gameId,
    targetUid,
    skill,
  });
}

export async function hostTransferHost(
  gameId: string,
  newHostId: string
): Promise<{ ok: boolean; newHostId: string }> {
  return callFunction('hostTransferHost', { gameId, newHostId });
}

export async function hostLeaveWithAi(
  gameId: string,
  options: { newHostId?: string; skill?: WarpSkillLevel } = {}
): Promise<{
  ok: boolean;
  aiId: string;
  displayName: string;
  skill: string;
  newHostId: string;
}> {
  return callFunction('hostLeaveWithAi', {
    gameId,
    ...(options.newHostId ? { newHostId: options.newHostId } : {}),
    ...(options.skill ? { skill: options.skill } : {}),
  });
}

export async function hostMuteInSector(
  gameId: string,
  uid: string,
  reason?: string
): Promise<{ ok: boolean; muted: boolean }> {
  return callFunction('hostMuteInSector', {
    gameId,
    uid,
    ...(reason ? { reason } : {}),
  });
}

export async function hostUnmuteInSector(
  gameId: string,
  uid: string
): Promise<{ ok: boolean; muted: boolean }> {
  return callFunction('hostUnmuteInSector', { gameId, uid });
}
