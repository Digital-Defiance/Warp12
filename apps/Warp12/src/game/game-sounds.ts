import {
  getWarp12SynthEngine,
  resetWarp12SynthEngineForTests,
} from './warp12-synth-engine.js';

export type GameSound =
  | 'hail'
  | 'consoleWarning'
  | 'redAlert'
  | 'allStop'
  | 'dropToImpulse'
  | 'returnToWarp'
  | 'flash';

const ALL_GAME_SOUNDS: readonly GameSound[] = [
  'hail',
  'consoleWarning',
  'redAlert',
  'allStop',
  'dropToImpulse',
  'returnToWarp',
  'flash',
];

let bridgeAmbienceEnabled = false;
let backgroundSuspended = false;
let audioUnlocked = false;

export function readStoredGameSoundsMuted(): boolean {
  try {
    return localStorage.getItem('warp12-sounds-muted') === 'true';
  } catch {
    return false;
  }
}

let soundsMuted = readStoredGameSoundsMuted();

export function storeGameSoundsMuted(muted: boolean): void {
  try {
    localStorage.setItem('warp12-sounds-muted', String(muted));
  } catch {
    /* ignore quota / private mode */
  }
}

export function setGameSoundsMuted(muted: boolean): void {
  soundsMuted = muted;
  if (muted) {
    stopGameSounds();
  } else {
    refreshBridgeAmbiencePlayback();
  }
}

export function areGameSoundsMuted(): boolean {
  return soundsMuted;
}

function stopGameSounds(): void {
  const synth = getWarp12SynthEngine();
  synth.stopAmbience();
  for (const sound of ALL_GAME_SOUNDS) {
    synth.stopGameSound(sound);
  }
}

function pauseBridgeAmbience(): void {
  getWarp12SynthEngine().stopAmbience();
}

function suspendBridgeAmbience(): void {
  getWarp12SynthEngine().stopAmbience();
}

function refreshBridgeAmbiencePlayback(): void {
  if (bridgeAmbienceEnabled && audioUnlocked && !soundsMuted && !backgroundSuspended) {
    getWarp12SynthEngine().startAmbience();
  } else if (backgroundSuspended) {
    suspendBridgeAmbience();
  } else {
    pauseBridgeAmbience();
  }
}

/** Loop bridge ambience under one-shot table SFX. */
export function setBridgeAmbienceEnabled(enabled: boolean): void {
  bridgeAmbienceEnabled = enabled;
  refreshBridgeAmbiencePlayback();
}

export function setGameAudioBackgroundSuspended(suspended: boolean): void {
  backgroundSuspended = suspended;
  if (suspended) {
    suspendBridgeAmbience();
    return;
  }
  refreshBridgeAmbiencePlayback();
}

export function isGameAudioBackgroundSuspended(): boolean {
  return backgroundSuspended;
}

/** @internal Resets module audio singletons between unit tests. */
export function resetGameAudioStateForTests(): void {
  stopGameSounds();
  bridgeAmbienceEnabled = false;
  backgroundSuspended = false;
  audioUnlocked = false;
  soundsMuted = false;
  resetWarp12SynthEngineForTests();
}

export function isBridgeAmbienceEnabled(): boolean {
  return bridgeAmbienceEnabled;
}

/** Prime audio after a user gesture (browser autoplay policy). */
export function unlockGameAudio(): void {
  audioUnlocked = true;
  void getWarp12SynthEngine().ensureContext();
  refreshBridgeAmbiencePlayback();
}

export function stopGameSound(sound: GameSound): void {
  getWarp12SynthEngine().stopGameSound(sound);
}

export function playGameSound(
  sound: GameSound,
  options?: { delayMs?: number }
): void {
  if (!audioUnlocked || soundsMuted || backgroundSuspended) {
    return;
  }
  getWarp12SynthEngine().playGameSound(sound, {
    delayMs: options?.delayMs ?? 0,
  });
}

/** Play a chart chirp for the given slot (1–77 pentatonic mapping). */
export function playTurnBeepById(
  chartSlot: number,
  options?: { delayMs?: number }
): void {
  if (!audioUnlocked || soundsMuted || backgroundSuspended) {
    return;
  }
  getWarp12SynthEngine().playTurnBeep(chartSlot, options?.delayMs ?? 0);
}

/** Table event sounds available for preview. */
export const PREVIEWABLE_GAME_SOUNDS = ALL_GAME_SOUNDS;

export const GAME_SOUND_PREVIEW_LABELS: Record<GameSound, string> = {
  hail: 'Hail (your turn)',
  consoleWarning: 'Console warning (double charted)',
  redAlert: 'Red alert',
  allStop: 'All Stop (power down)',
  dropToImpulse: 'Drop to impulse',
  returnToWarp: 'Return to warp',
  flash: 'Continuum Flash',
};

/** Play a table sound immediately — bypasses mute for intentional preview taps. */
export function previewGameSound(sound: GameSound): void {
  unlockGameAudio();
  if (backgroundSuspended) {
    return;
  }
  getWarp12SynthEngine().playGameSound(sound, { delayMs: 0 });
}

/** Preview a chart chirp by slot (1–77). */
export function previewTurnBeep(chartSlot: number): void {
  unlockGameAudio();
  if (backgroundSuspended) {
    return;
  }
  getWarp12SynthEngine().playTurnBeep(chartSlot, 0);
}

/** Dev console helpers — `warp12.previewSound('allStop')` etc. */
export interface Warp12DevTools {
  readonly previewSound: typeof previewGameSound;
  readonly previewBeep: typeof previewTurnBeep;
  readonly previewAllStopWithBridgeHum: () => void;
  readonly startBridgeHum: () => void;
  readonly sounds: typeof PREVIEWABLE_GAME_SOUNDS;
  readonly soundLabels: typeof GAME_SOUND_PREVIEW_LABELS;
}

declare global {
  interface Window {
    warp12?: Warp12DevTools;
  }
}

export function installGameSoundDevTools(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }
  window.warp12 = {
    previewSound: previewGameSound,
    previewBeep: previewTurnBeep,
    previewAllStopWithBridgeHum: () => {
      unlockGameAudio();
      getWarp12SynthEngine().startAmbience();
      previewGameSound('allStop');
    },
    startBridgeHum: () => {
      unlockGameAudio();
      getWarp12SynthEngine().startAmbience();
    },
    sounds: PREVIEWABLE_GAME_SOUNDS,
    soundLabels: GAME_SOUND_PREVIEW_LABELS,
  };
}
