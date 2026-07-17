import { callFunction } from './functions-client.js';

export async function joinSpectate(gameId: string): Promise<{ spectating: boolean }> {
  return callFunction('joinSpectate', { gameId });
}

export async function leaveSpectate(gameId: string): Promise<{ spectating: boolean }> {
  return callFunction('leaveSpectate', { gameId });
}

export async function setAllowSpectate(
  gameId: string,
  allow: boolean
): Promise<{ allowSpectate: boolean }> {
  return callFunction('setAllowSpectate', { gameId, allow });
}
