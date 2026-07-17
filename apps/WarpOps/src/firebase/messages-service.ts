import { callFunction } from './functions-client';

export type OpsMessageHit = {
  gameId: string;
  messageId: string;
  from: string;
  fromName: string;
  kind: string;
  text: string | null;
  phraseId: string | null;
  to: string | null;
  channel: string;
  at: string;
};

export type SearchMessagesParams = {
  text?: string;
  fromUid?: string;
  fromName?: string;
  gameId?: string;
  fromIso?: string;
  toIso?: string;
  limit?: number;
};

export async function searchMessages(params: SearchMessagesParams): Promise<{
  hits: OpsMessageHit[];
  scanned: number;
  window: { fromIso: string | null; toIso: string };
  note: string | null;
}> {
  return callFunction('searchMessages', params);
}

export async function listSectorMessages(
  gameId: string,
  limit = 200
): Promise<{ messages: OpsMessageHit[]; gameId: string }> {
  return callFunction('listSectorMessages', { gameId, limit });
}

export async function deleteSectorMessage(
  gameId: string,
  messageId: string,
  reason?: string
): Promise<{ deleted: boolean }> {
  return callFunction('deleteSectorMessage', { gameId, messageId, reason });
}

export async function redactSectorMessage(
  gameId: string,
  messageId: string,
  reason?: string
): Promise<{ redacted: boolean }> {
  return callFunction('redactSectorMessage', { gameId, messageId, reason });
}
