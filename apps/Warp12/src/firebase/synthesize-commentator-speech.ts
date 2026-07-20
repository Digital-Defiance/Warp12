import { callFunction } from './functions-client.js';
import type { GameLogEntry, PronounForms } from 'warp12-react';

export interface SynthesizeCommentatorSpeechInput {
  readonly entry: GameLogEntry;
  /** Optional batch (includes `entry` as first). Uncached merge only. */
  readonly entries?: readonly GameLogEntry[];
  readonly names: Readonly<Record<string, string>>;
  readonly pronouns?: Readonly<Record<string, PronounForms>>;
  readonly roundStartedAtMs: number;
  /** Per-match Storage folder (`tts-cache/matches/{matchId}/`). */
  readonly matchId: string;
  /** Optional sector invite / display tag. */
  readonly sectorCode?: string;
  /**
   * Probe Storage only — never call ElevenLabs.
   * Misses return `cacheHit: false` with empty `audioBase64`.
   */
  readonly cacheOnly?: boolean;
}

export interface SynthesizeCommentatorSpeechResult {
  readonly cacheHit: boolean;
  readonly contentType: string;
  readonly line: string;
  readonly speechText: string;
  readonly audioBase64: string;
  readonly cacheKey: string;
  readonly matchId: string;
  readonly storagePath: string;
}

export async function synthesizeCommentatorSpeech(
  input: SynthesizeCommentatorSpeechInput
): Promise<SynthesizeCommentatorSpeechResult> {
  return callFunction('synthesizeCommentatorSpeech', input);
}

/** Play base64 MP3; no-ops if another clip is already playing. */
export function createCommentatorAudioPlayer(): {
  playBase64Mp3: (audioBase64: string) => Promise<void>;
  busy: () => boolean;
} {
  let current: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;

  const cleanup = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    current = null;
  };

  return {
    busy: () => current != null,
    playBase64Mp3: async (audioBase64: string) => {
      if (current || !audioBase64) {
        return;
      }
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      objectUrl = URL.createObjectURL(
        new Blob([bytes], { type: 'audio/mpeg' })
      );
      const audio = new Audio(objectUrl);
      current = audio;
      try {
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.addEventListener('ended', () => resolve(), { once: true });
          audio.addEventListener('error', () => resolve(), { once: true });
        });
      } catch {
        // Autoplay / decode failures — text overlay still works.
      } finally {
        cleanup();
      }
    },
  };
}
