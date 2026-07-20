import { defineString } from 'firebase-functions/params';

/**
 * One-time passphrase for the first admin claim at /admin.
 * Set in functions/.env (see .env.example) — no Secret Manager / Blaze secret API required.
 */
export const bootstrapAdminSecret = defineString('BOOTSTRAP_ADMIN_SECRET');

/**
 * HMAC secret for match certificate signatures (JSON + PDF).
 * Set in functions/.env as CERTIFICATE_SIGNING_SECRET.
 */
export const certificateSigningSecret = defineString('CERTIFICATE_SIGNING_SECRET');

/**
 * ElevenLabs API key for admin-only commentator TTS.
 * Set in functions/.env as ELEVENLABS_API_KEY — never expose to the client.
 */
export const elevenLabsApiKey = defineString('ELEVENLABS_API_KEY', {
  default: '',
});

/** Default ElevenLabs voice for federation commentary. */
export const elevenLabsVoiceId = defineString('ELEVENLABS_VOICE_ID', {
  default: 'aD6riP1btT197c6dACmy',
});

/** ElevenLabs model id (e.g. eleven_v3). */
export const elevenLabsModelId = defineString('ELEVENLABS_MODEL_ID', {
  default: 'eleven_v3',
});

/**
 * Optional ElevenLabs pronunciation dictionary for fleet / AI officer names.
 * Keep dictionary id stable (`yarn tts:pronunciation-dictionary` updates
 * rules in place); bump VERSION_ID after each lexicon sync (included in TTS cache key).
 */
export const elevenLabsPronunciationDictionaryId = defineString(
  'ELEVENLABS_PRONUNCIATION_DICTIONARY_ID',
  { default: '' }
);

export const elevenLabsPronunciationDictionaryVersionId = defineString(
  'ELEVENLABS_PRONUNCIATION_DICTIONARY_VERSION_ID',
  { default: '' }
);

/**
 * Firebase Storage bucket for TTS cache / certificates.
 * Must match the web app `VITE_FIREBASE_STORAGE_BUCKET`
 * (e.g. warp-12.firebasestorage.app). Named GCS_BUCKET because Functions
 * .env forbids the FIREBASE_ prefix.
 */
export const gcsBucket = defineString('GCS_BUCKET', {
  default: 'warp-12.firebasestorage.app',
});
