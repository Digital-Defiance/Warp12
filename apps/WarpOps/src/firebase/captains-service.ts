import { callFunction } from './functions-client';

export type CaptainSearchHit = {
  uid: string;
  displayName: string;
  matchesCompleted: number;
  matchesWon: number;
  lastPlayedAt: string | null;
  updatedAt: string | null;
  match: 'uid' | 'email' | 'name';
};

export type AdminNote = {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  createdByLabel: string;
  updatedAt?: string;
};

export type WarpOpsRole = 'admin' | 'moderator' | 'match_official';

export type CaptainDossier = {
  uid: string;
  displayName: string;
  speakAs: string | null;
  email: string | null;
  authDisabled: boolean;
  anonymous: boolean;
  providers: string[];
  roles: WarpOpsRole[];
  createdAt: string | null;
  lastSignInAt: string | null;
  stats: {
    matchesCompleted: number;
    matchesWon: number;
    lastPlayedAt: string | null;
    updatedAt: string | null;
    humanRating: unknown;
    groupRating: unknown;
    squadRating: unknown;
    localAi: unknown;
    startingRating: unknown;
    humanRatedGameIds: string[];
    groupRatedIds: string[];
    squadRatedGameIds: string[];
    matchHistory: unknown[];
  } | null;
  ban: Record<string, unknown> | null;
  banned: boolean;
  mute: Record<string, unknown> | null;
  muted: boolean;
  notes: AdminNote[];
};

export async function searchCaptains(query: string, limit = 40): Promise<{
  hits: CaptainSearchHit[];
  scanned?: number;
  note?: string;
}> {
  return callFunction('searchCaptains', { query, limit });
}

export async function getCaptainDossier(uid: string): Promise<{
  dossier: CaptainDossier;
}> {
  return callFunction('getCaptainDossier', { uid });
}

export async function addAdminNote(
  uid: string,
  text: string
): Promise<{ note: AdminNote }> {
  return callFunction('addAdminNote', { uid, text });
}

export async function updateAdminNote(
  uid: string,
  noteId: string,
  text: string
): Promise<{ note: AdminNote }> {
  return callFunction('updateAdminNote', { uid, noteId, text });
}

export async function deleteAdminNote(
  uid: string,
  noteId: string
): Promise<{ deleted: boolean }> {
  return callFunction('deleteAdminNote', { uid, noteId });
}

export async function opsSetDisplayName(input: {
  uid: string;
  displayName: string;
  reason: string;
}): Promise<{ ok: true; uid: string; displayName: string; previous: string | null }> {
  return callFunction('opsSetDisplayName', input);
}

export async function setUserRoles(input: {
  uid: string;
  roles: WarpOpsRole[];
}): Promise<{ ok: true; uid: string; roles: WarpOpsRole[] }> {
  return callFunction('setUserRoles', input);
}
