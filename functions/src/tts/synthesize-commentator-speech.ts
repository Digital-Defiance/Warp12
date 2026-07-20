import { createHash } from 'node:crypto';

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  commentatorLineIsSane,
  formatCommentatorLine,
} from 'warp12-engine';

import { requireAdmin } from '../auth';
import {
  elevenLabsApiKey,
  elevenLabsModelId,
  elevenLabsPronunciationDictionaryId,
  elevenLabsPronunciationDictionaryVersionId,
  elevenLabsVoiceId,
} from '../params';
import {
  audioStreamToBuffer,
  elevenLabsErrorMessage,
  isElevenLabsRateLimited,
  isPronunciationDictionaryNotFound,
} from './elevenlabs-audio';
import { enforceTtsQuota } from './quota';
import { ttsObjectPath } from './cache-admin';
import {
  getAppStorageBucket,
  isMissingStorageBucketError,
} from '../storage-bucket';
import {
  assertSpeechLineAcceptable,
  joinCommentatorSpeechTexts,
  maxSpeechLenForEntryCount,
  parseSynthesizeRequest,
  speechTextFromCommentatorLine,
  ttsCacheKey,
} from './request-parse';

async function convertSpeechAudio(
  client: ElevenLabsClient,
  voiceId: string,
  modelId: string,
  speechText: string,
  dictionaryId: string,
  dictionaryVersion: string
): Promise<Buffer> {
  const convert = async (useDictionary: boolean) => {
    const stream = await client.textToSpeech.convert(voiceId, {
      modelId,
      text: speechText,
      outputFormat: 'mp3_44100_128',
      ...(useDictionary && dictionaryId
        ? {
            pronunciationDictionaryLocators: [
              {
                pronunciationDictionaryId: dictionaryId,
                ...(dictionaryVersion ? { versionId: dictionaryVersion } : {}),
              },
            ],
          }
        : {}),
    });
    return audioStreamToBuffer(stream);
  };

  if (!dictionaryId) {
    return convert(false);
  }

  try {
    return await convert(true);
  } catch (err) {
    if (!isPronunciationDictionaryNotFound(err)) {
      throw err;
    }
    // Stale VERSION_ID / archived dict should not silence commentary.
    console.warn(
      '[tts] pronunciation dictionary locator failed; retrying without dictionary',
      dictionaryId,
      dictionaryVersion || '(latest)'
    );
    return convert(false);
  }
}

export const synthesizeCommentatorSpeech = onCall(
  {
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    const uid = requireAdmin(request);

    let parsed;
    try {
      parsed = parseSynthesizeRequest(request.data);
    } catch (err) {
      throw new HttpsError(
        'invalid-argument',
        err instanceof Error ? err.message : 'Invalid TTS request.'
      );
    }

    const formatOpts = {
      roundStartedAtMs: parsed.roundStartedAtMs,
      pronouns: parsed.pronouns,
    };
    const speechParts: string[] = [];
    const lineParts: string[] = [];
    for (const entry of parsed.entries) {
      const line = formatCommentatorLine(entry, parsed.names, formatOpts);
      try {
        assertSpeechLineAcceptable(line);
      } catch {
        continue;
      }
      if (!commentatorLineIsSane(line)) {
        continue;
      }
      const speech = speechTextFromCommentatorLine(line);
      if (!speech) {
        continue;
      }
      lineParts.push(line);
      speechParts.push(speech);
    }

    if (speechParts.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'No commentator highlights in request.'
      );
    }

    const line = lineParts.join(' — ');
    const speechText = joinCommentatorSpeechTexts(speechParts);
    const maxLen = maxSpeechLenForEntryCount(speechParts.length);
    try {
      assertSpeechLineAcceptable(speechText, maxLen);
    } catch (err) {
      throw new HttpsError(
        'failed-precondition',
        err instanceof Error ? err.message : 'Speech too long.'
      );
    }

    const voiceId = elevenLabsVoiceId.value();
    const modelId = elevenLabsModelId.value();
    const dictionaryId = elevenLabsPronunciationDictionaryId.value().trim();
    const dictionaryVersion = elevenLabsPronunciationDictionaryVersionId
      .value()
      .trim();
    const cacheHash = ttsCacheKey(
      voiceId,
      modelId,
      speechText,
      dictionaryId,
      dictionaryVersion
    );
    const storagePath = ttsObjectPath(parsed.matchId, cacheHash);
    const bucket = getAppStorageBucket();
    const file = bucket.file(storagePath);

    try {
      const [exists] = await file.exists();
      if (exists) {
        await enforceTtsQuota(uid, { countGeneration: false });
        const [buf] = await file.download();
        return {
          cacheHit: true,
          contentType: 'audio/mpeg',
          line,
          speechText,
          audioBase64: buf.toString('base64'),
          cacheKey: cacheHash,
          matchId: parsed.matchId,
          storagePath,
        };
      }
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      // Missing / misconfigured bucket → treat as cache miss and continue.
      if (!isMissingStorageBucketError(err)) {
        console.warn('[tts] cache lookup failed; continuing without cache', err);
      }
    }

    if (parsed.cacheOnly) {
      return {
        cacheHit: false,
        contentType: 'audio/mpeg',
        line,
        speechText,
        audioBase64: '',
        cacheKey: cacheHash,
        matchId: parsed.matchId,
        storagePath,
      };
    }

    await enforceTtsQuota(uid, { countGeneration: true });

    const apiKey = elevenLabsApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'ELEVENLABS_API_KEY is not configured on Functions.'
      );
    }

    const client = new ElevenLabsClient({ apiKey });
    let audioBuf: Buffer;
    try {
      audioBuf = await convertSpeechAudio(
        client,
        voiceId,
        modelId,
        speechText,
        dictionaryId,
        dictionaryVersion
      );
    } catch (err) {
      // Prefer resource-exhausted for 429 so clients can back off without
      // treating it as a hard outage (and so the message is not stripped).
      if (isElevenLabsRateLimited(err)) {
        throw new HttpsError(
          'resource-exhausted',
          `ElevenLabs TTS rate limited: ${elevenLabsErrorMessage(err)}`
        );
      }
      throw new HttpsError(
        'unavailable',
        `ElevenLabs TTS failed: ${elevenLabsErrorMessage(err)}`
      );
    }

    if (audioBuf.length === 0) {
      throw new HttpsError('unavailable', 'ElevenLabs returned empty audio.');
    }

    const customMeta: Record<string, string> = {
      matchId: parsed.matchId,
      voiceId,
      modelId,
      lineHash: createHash('sha256').update(line).digest('hex'),
    };
    if (parsed.sectorCode) {
      customMeta.sectorCode = parsed.sectorCode;
    }

    try {
      await file.save(audioBuf, {
        contentType: 'audio/mpeg',
        resumable: false,
        metadata: {
          cacheControl: 'public, max-age=604800',
          metadata: customMeta,
        },
      });
    } catch (err) {
      // Still return playable audio — cache is best-effort.
      console.warn(
        '[tts] cache write failed; returning audio without cache',
        storagePath,
        err instanceof Error ? err.message : err
      );
    }

    return {
      cacheHit: false,
      contentType: 'audio/mpeg',
      line,
      speechText,
      audioBase64: audioBuf.toString('base64'),
      cacheKey: cacheHash,
      matchId: parsed.matchId,
      storagePath,
    };
  }
);
