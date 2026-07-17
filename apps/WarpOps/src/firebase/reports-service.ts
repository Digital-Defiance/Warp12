import { callFunction } from './functions-client';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type ModerationReport = {
  reportId: string;
  source: string;
  status: ReportStatus;
  category: string;
  subjectType: string;
  reporterUid: string | null;
  targetUid: string | null;
  gameId: string | null;
  messageId: string | null;
  reason: string;
  detector?: string;
  priority?: string;
  matchedTerms?: string[];
  evidence?: Record<string, unknown>;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentReviewConfig = {
  chatTerms: string[];
  displayNameTerms: string[];
  allowlist: string[];
  updatedAt?: string;
  updatedBy?: string;
};

export async function listModerationReports(
  status: ReportStatus | 'all' = 'open',
  limit = 100,
  opts?: { source?: string | 'all'; category?: string | 'all' }
): Promise<{ reports: ModerationReport[] }> {
  return callFunction('listModerationReports', {
    status,
    limit,
    source: opts?.source,
    category: opts?.category,
  });
}

export async function getModerationEvidencePack(input: {
  reportId?: string;
  gameId?: string;
  targetUid?: string;
}): Promise<{ ok: true; pack: Record<string, unknown> }> {
  return callFunction('getModerationEvidencePack', input);
}

export async function updateModerationReport(input: {
  reportId: string;
  status: ReportStatus;
  resolutionNote?: string;
}): Promise<{ ok: true; reportId: string; status: ReportStatus }> {
  return callFunction('updateModerationReport', input);
}

export async function getContentReviewConfig(): Promise<{
  config: ContentReviewConfig;
}> {
  return callFunction('getContentReviewConfig', {});
}

export async function updateContentReviewConfig(input: {
  chatTerms: string[];
  displayNameTerms: string[];
  allowlist: string[];
}): Promise<{ config: ContentReviewConfig }> {
  return callFunction('updateContentReviewConfig', input);
}
