import { callFunction } from './functions-client.js';

export async function hostDropCaptain(
  gameId: string,
  targetUid: string,
  reason?: string
): Promise<{ ok: boolean; mode: 'kicked' | 'terminated' }> {
  return callFunction<
    { gameId: string; targetUid: string; reason?: string },
    { ok: boolean; mode: 'kicked' | 'terminated' }
  >('hostDropCaptain', {
    gameId,
    targetUid,
    ...(reason ? { reason } : {}),
  });
}
