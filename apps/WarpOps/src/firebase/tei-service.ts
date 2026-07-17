import { callFunction } from './functions-client';

export type TeiPool = 'human' | 'squad' | 'localAi' | 'group';
export type TeiTrack = 'goOut' | 'points';
export type LocalAiSkill = 'ensign' | 'lieutenant' | 'commander';

export type StoredRatingView = {
  mu: number;
  sigma: number;
  matches: number;
  displayRating: number;
  displayGrade?: string;
};

export async function getOpsRatedMatch(matchCode: string): Promise<{
  ok: true;
  match: Record<string, unknown>;
}> {
  return callFunction('getOpsRatedMatch', { matchCode });
}

export async function opsSetCaptainRating(input: {
  uid: string;
  pool: TeiPool;
  track: TeiTrack;
  skill?: LocalAiSkill;
  charterId?: string;
  mu: number;
  sigma: number;
  matches?: number;
  reason: string;
}): Promise<{
  ok: true;
  uid: string;
  fieldPath: string;
  before: StoredRatingView | null;
  after: StoredRatingView;
}> {
  return callFunction('opsSetCaptainRating', input);
}

export async function opsVoidRatedMatch(
  matchCode: string,
  reason: string
): Promise<{
  ok: true;
  matchCode: string;
  alreadyVoided?: boolean;
  strippedCount?: number;
  ledgerEventsMarked?: number;
  note?: string;
}> {
  return callFunction('opsVoidRatedMatch', { matchCode, reason });
}

export async function opsUnrateOnlineSector(
  gameId: string,
  reason: string
): Promise<{
  ok: true;
  gameId: string;
  matchCode?: string;
  alreadyUnrated?: boolean;
  strippedCount?: number;
  ledgerEventsMarked?: number;
  note?: string;
}> {
  return callFunction('opsUnrateOnlineSector', { gameId, reason });
}

export async function listCaptainRatingEvents(
  uid: string,
  limit = 40
): Promise<{ ok: true; uid: string; events: Record<string, unknown>[] }> {
  return callFunction('listCaptainRatingEvents', { uid, limit });
}

export async function listMatchRatingEvents(
  matchId: string
): Promise<{ ok: true; matchId: string; events: Record<string, unknown>[] }> {
  return callFunction('listMatchRatingEvents', { matchId });
}

export async function opsCascadeFromRatingEvent(input: {
  eventId: string;
  reason: string;
  dryRun?: boolean;
}): Promise<{
  ok: true;
  dryRun: boolean;
  eventId: string;
  matchId: string;
  pool: string;
  track: string;
  results: Array<{
    uid: string;
    restoredTo: StoredRatingView;
    steps: Array<{
      eventId: string;
      matchId: string;
      uid: string;
      before: StoredRatingView;
      after: StoredRatingView;
    }>;
  }>;
  note?: string;
}> {
  return callFunction('opsCascadeFromRatingEvent', input);
}
