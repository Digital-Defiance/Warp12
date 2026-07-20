import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from '../auth';
import { OPS_AUDIT_COLLECTION } from '../ops/ban-schema';
import { getAppStorageBucket } from '../storage-bucket';
import {
  TTS_CACHE_MATCHES_PREFIX,
  TTS_CACHE_PREFIX,
  matchIdFromObjectName,
  parseTtsMatchId,
  ttsMatchPrefix,
  ttsObjectPath,
} from './storage-paths';

export {
  TTS_CACHE_MATCHES_PREFIX,
  TTS_CACHE_PREFIX,
  isValidTtsMatchId,
  matchIdFromObjectName,
  parseTtsMatchId,
  ttsMatchPrefix,
  ttsObjectPath,
} from './storage-paths';

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

function customMetaString(
  custom: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = custom?.[key];
  return typeof value === 'string' ? value : null;
}

function summarizeFile(file: {
  name: string;
  metadata?: {
    size?: string | number;
    updated?: string;
    contentType?: string;
    metadata?: Record<string, unknown>;
  };
}): TtsCacheObjectSummary {
  const meta = file.metadata ?? {};
  const custom = meta.metadata;
  const sizeRaw = meta.size;
  const sizeBytes =
    typeof sizeRaw === 'number'
      ? sizeRaw
      : typeof sizeRaw === 'string'
        ? Number(sizeRaw) || 0
        : 0;
  const matchId =
    customMetaString(custom, 'matchId') ?? matchIdFromObjectName(file.name);
  const baseName = file.name.includes('/')
    ? file.name.slice(file.name.lastIndexOf('/') + 1)
    : file.name;
  const cacheKey = baseName.replace(/\.mp3$/i, '');
  return {
    name: file.name,
    matchId,
    cacheKey,
    sizeBytes,
    updatedAt: typeof meta.updated === 'string' ? meta.updated : null,
    contentType: typeof meta.contentType === 'string' ? meta.contentType : null,
    voiceId: customMetaString(custom, 'voiceId'),
    modelId: customMetaString(custom, 'modelId'),
    sectorCode: customMetaString(custom, 'sectorCode'),
  };
}

async function writeTtsCacheAudit(
  actorUid: string,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  await admin.firestore().collection(OPS_AUDIT_COLLECTION).add({
    action,
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: null,
    targetBanId: null,
    detail,
    at: Timestamp.now(),
  });
}

function resolveListPrefix(matchIdFilter: string | undefined): string {
  if (!matchIdFilter) {
    return TTS_CACHE_MATCHES_PREFIX;
  }
  return ttsMatchPrefix(matchIdFilter);
}

/** List cached commentator MP3s, optionally scoped to one match folder. Admin only. */
export const listTtsCache = onCall(
  { timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    requireAdmin(request);
    const data = request.data as {
      pageSize?: number;
      pageToken?: string;
      matchId?: string;
    };
    const pageSize = Math.min(Math.max(Number(data.pageSize) || 50, 1), 200);
    const pageToken =
      typeof data.pageToken === 'string' && data.pageToken.trim()
        ? data.pageToken.trim()
        : undefined;

    let matchIdFilter: string | undefined;
    try {
      if (data.matchId != null && String(data.matchId).trim()) {
        matchIdFilter = parseTtsMatchId(data.matchId);
      }
    } catch (err) {
      throw new HttpsError(
        'invalid-argument',
        err instanceof Error ? err.message : 'Invalid matchId.'
      );
    }

    const listPrefix = resolveListPrefix(matchIdFilter);
    const bucket = getAppStorageBucket();
    const [files, , apiResponse] = await bucket.getFiles({
      prefix: listPrefix,
      maxResults: pageSize,
      autoPaginate: false,
      ...(pageToken ? { pageToken } : {}),
    });

    const objects = files
      .filter((f) => f.name.endsWith('.mp3'))
      .map((f) => summarizeFile(f));

    const nextPageToken =
      apiResponse &&
      typeof apiResponse === 'object' &&
      'nextPageToken' in apiResponse &&
      typeof (apiResponse as { nextPageToken?: unknown }).nextPageToken ===
        'string'
        ? (apiResponse as { nextPageToken: string }).nextPageToken
        : null;

    let approxTotal: number | null = null;
    let approxBytes: number | null = null;
    const matchFolders: TtsMatchFolderSummary[] = [];

    if (!pageToken) {
      let total = 0;
      let bytes = 0;
      const folderAgg = new Map<
        string,
        {
          objectCount: number;
          sizeBytes: number;
          sectorCode: string | null;
          updatedAt: string | null;
        }
      >();

      const [all] = await bucket.getFiles({
        prefix: listPrefix,
        maxResults: 2000,
        autoPaginate: false,
      });
      for (const f of all) {
        if (!f.name.endsWith('.mp3')) {
          continue;
        }
        total += 1;
        const summary = summarizeFile(f);
        bytes += summary.sizeBytes;
        const mid = summary.matchId;
        if (mid) {
          const prev = folderAgg.get(mid) ?? {
            objectCount: 0,
            sizeBytes: 0,
            sectorCode: null,
            updatedAt: null,
          };
          prev.objectCount += 1;
          prev.sizeBytes += summary.sizeBytes;
          if (summary.sectorCode) {
            prev.sectorCode = summary.sectorCode;
          }
          if (
            summary.updatedAt &&
            (!prev.updatedAt || summary.updatedAt > prev.updatedAt)
          ) {
            prev.updatedAt = summary.updatedAt;
          }
          folderAgg.set(mid, prev);
        }
      }
      approxTotal = total;
      approxBytes = bytes;

      if (!matchIdFilter) {
        for (const [matchId, agg] of [...folderAgg.entries()].sort((a, b) =>
          a[0].localeCompare(b[0])
        )) {
          matchFolders.push({
            matchId,
            prefix: ttsMatchPrefix(matchId),
            objectCount: agg.objectCount,
            sizeBytes: agg.sizeBytes,
            sectorCode: agg.sectorCode,
            updatedAt: agg.updatedAt,
          });
        }
      }
    }

    return {
      ok: true as const,
      prefix: listPrefix,
      rootPrefix: TTS_CACHE_PREFIX,
      matchesPrefix: TTS_CACHE_MATCHES_PREFIX,
      matchId: matchIdFilter ?? null,
      objects,
      matchFolders,
      nextPageToken,
      approxTotal,
      approxBytes,
      truncatedAt: 2000,
    };
  }
);

/** Delete objects / a match folder / entire TTS cache. Admin only. */
export const purgeTtsCache = onCall(
  { timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const actorUid = requireAdmin(request);
    const data = request.data as {
      purgeAll?: boolean;
      matchId?: string;
      names?: string[];
      cacheKeys?: string[];
      reason?: string;
    };
    const reason = data.reason?.trim();
    if (!reason) {
      throw new HttpsError('invalid-argument', 'reason required.');
    }

    const bucket = getAppStorageBucket();
    const toDelete = new Set<string>();

    let matchIdForPurge: string | undefined;
    try {
      if (data.matchId != null && String(data.matchId).trim()) {
        matchIdForPurge = parseTtsMatchId(data.matchId);
      }
    } catch (err) {
      throw new HttpsError(
        'invalid-argument',
        err instanceof Error ? err.message : 'Invalid matchId.'
      );
    }

    if (data.purgeAll === true) {
      const [files] = await bucket.getFiles({ prefix: TTS_CACHE_PREFIX });
      for (const f of files) {
        if (f.name.endsWith('.mp3')) {
          toDelete.add(f.name);
        }
      }
    } else if (matchIdForPurge && !(data.names?.length || data.cacheKeys?.length)) {
      const [files] = await bucket.getFiles({
        prefix: ttsMatchPrefix(matchIdForPurge),
      });
      for (const f of files) {
        if (f.name.endsWith('.mp3')) {
          toDelete.add(f.name);
        }
      }
    } else {
      for (const name of data.names ?? []) {
        if (typeof name !== 'string') {
          continue;
        }
        const trimmed = name.trim();
        if (
          trimmed.startsWith(TTS_CACHE_PREFIX) &&
          trimmed.endsWith('.mp3') &&
          !trimmed.includes('..')
        ) {
          toDelete.add(trimmed);
        }
      }
      for (const key of data.cacheKeys ?? []) {
        if (typeof key !== 'string' || !matchIdForPurge) {
          continue;
        }
        const hash = key.trim().replace(/\.mp3$/i, '');
        if (/^[a-f0-9]{64}$/i.test(hash)) {
          toDelete.add(ttsObjectPath(matchIdForPurge, hash));
        }
      }
    }

    if (toDelete.size === 0) {
      throw new HttpsError(
        'invalid-argument',
        'Nothing to delete — pass purgeAll, matchId, or names.'
      );
    }

    if (toDelete.size > 500) {
      throw new HttpsError(
        'invalid-argument',
        'Refusing to delete more than 500 objects in one call.'
      );
    }

    let deleted = 0;
    const errors: string[] = [];
    await Promise.all(
      [...toDelete].map(async (name) => {
        try {
          await bucket.file(name).delete({ ignoreNotFound: true });
          deleted += 1;
        } catch (err) {
          errors.push(
            err instanceof Error ? `${name}: ${err.message}` : `${name}: failed`
          );
        }
      })
    );

    await writeTtsCacheAudit(actorUid, 'tts_cache_purge', {
      reason,
      purgeAll: data.purgeAll === true,
      matchId: matchIdForPurge ?? null,
      requested: toDelete.size,
      deleted,
      errors: errors.slice(0, 20),
    });

    return {
      ok: true as const,
      deleted,
      requested: toDelete.size,
      errors,
      matchId: matchIdForPurge ?? null,
    };
  }
);
