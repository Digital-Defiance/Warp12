import { callFunction } from './functions-client.js';

export type PlayerReportCategory =
  | 'harassment'
  | 'spam'
  | 'cheating'
  | 'inappropriate-name'
  | 'other';

export async function reportSectorMessage(input: {
  gameId: string;
  messageId: string;
  category: PlayerReportCategory;
  reason: string;
}): Promise<{
  ok: true;
  reportId: string;
  alreadySubmitted: boolean;
}> {
  return callFunction('submitModerationReport', {
    ...input,
    subjectType: 'message',
  });
}

export async function reportSectorCaptain(input: {
  gameId: string;
  targetUid: string;
  category: PlayerReportCategory;
  reason: string;
}): Promise<{
  ok: true;
  reportId: string;
  alreadySubmitted: boolean;
}> {
  return callFunction('submitModerationReport', {
    ...input,
    subjectType: 'captain',
  });
}
