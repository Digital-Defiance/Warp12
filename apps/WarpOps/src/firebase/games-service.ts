import { callFunction } from './functions-client';

export type OpsGameCaptain = {
  id: string;
  displayName: string;
  isAi: boolean;
  verified?: boolean;
};

export type OpsGameSummary = {
  id: string;
  phase: string;
  hostId: string;
  createdAt: string;
  updatedAt: string;
  objective: string;
  rated: boolean;
  maxPip: number;
  maxPlayers: number;
  captainCount: number;
  captains: OpsGameCaptain[];
  charterId: string | null;
  completedRounds: number;
  campaignRounds: number;
  opsTerminated?: boolean;
  allowSpectate?: boolean;
  spectatorCount?: number;
};

export async function listActiveGames(limit = 100): Promise<{
  games: OpsGameSummary[];
  scanned?: number;
}> {
  return callFunction('listActiveGames', { limit });
}

export async function searchGames(input: {
  gameId?: string;
  hostId?: string;
  phase?: string;
  rated?: boolean | null;
  fromIso?: string;
  toIso?: string;
  limit?: number;
}): Promise<{ games: OpsGameSummary[]; scanned?: number }> {
  return callFunction('searchGames', input);
}

export async function getOpsGame(gameId: string): Promise<{
  game: OpsGameSummary;
  detail: Record<string, unknown>;
}> {
  return callFunction('getOpsGame', { gameId });
}

export type OpsHandRow = {
  playerId: string;
  displayName: string;
  tileCount: number;
  tiles: unknown[];
  seated: boolean;
};

export async function getOpsHands(gameId: string): Promise<{
  gameId: string;
  phase: string;
  roundPhase: string | null;
  hands: OpsHandRow[];
}> {
  return callFunction('getOpsHands', { gameId });
}
