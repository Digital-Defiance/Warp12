import { callFunction } from './functions-client';

export interface TtsCacheObjectSummary {
  readonly name: string;
  readonly matchId: string | null;
  readonly cacheKey: string;
  readonly sizeBytes: number;
  readonly updatedAt: string | null;
  readonly contentType: string | null;
  readonly voiceId: string | null;
  readonly modelId: string | null;
  readonly sectorCode: string | null;
}

export interface TtsMatchFolderSummary {
  readonly matchId: string;
  readonly prefix: string;
  readonly objectCount: number;
  readonly sizeBytes: number;
  readonly sectorCode: string | null;
  readonly updatedAt: string | null;
}

export interface ListTtsCacheResult {
  readonly ok: true;
  readonly prefix: string;
  readonly rootPrefix: string;
  readonly matchesPrefix: string;
  readonly matchId: string | null;
  readonly objects: readonly TtsCacheObjectSummary[];
  readonly matchFolders: readonly TtsMatchFolderSummary[];
  readonly nextPageToken: string | null;
  readonly approxTotal: number | null;
  readonly approxBytes: number | null;
  readonly truncatedAt: number;
}

export interface PurgeTtsCacheResult {
  readonly ok: true;
  readonly deleted: number;
  readonly requested: number;
  readonly errors: readonly string[];
  readonly matchId: string | null;
}

export function listTtsCache(input?: {
  pageSize?: number;
  pageToken?: string;
  matchId?: string;
}): Promise<ListTtsCacheResult> {
  return callFunction('listTtsCache', input ?? {});
}

export function purgeTtsCache(input: {
  purgeAll?: boolean;
  matchId?: string;
  names?: string[];
  cacheKeys?: string[];
  reason: string;
}): Promise<PurgeTtsCacheResult> {
  return callFunction('purgeTtsCache', input);
}

export function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
