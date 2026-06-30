export type GameSound =
  | 'hail'
  | 'consoleWarning'
  | 'redAlert'
  | 'allStop'
  | 'dropToImpulse'
  | 'returnToWarp'
  | 'qFlash';

const SOUND_URLS: Record<GameSound, string> = {
  hail: '/hailbeep.mp3',
  consoleWarning: '/consolewarning.mp3',
  redAlert: '/redalert.mp3',
  allStop: '/tng_poweringdown.mp3',
  dropToImpulse: '/tng_warp_exit.mp3',
  returnToWarp: '/tng_warp7.mp3',
  qFlash: '/qflash.mp3',
};

const BRIDGE_AMBIENCE_URL = '/tng_bridge_1.mp3';
const BRIDGE_AMBIENCE_VOLUME = 0.35;

const audioCache = new Map<GameSound, HTMLAudioElement>();
const turnBeepCache = new Map<string, HTMLAudioElement>();
let bridgeAmbienceClip: HTMLAudioElement | null = null;
let bridgeAmbienceEnabled = false;
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
  } else if (bridgeAmbienceEnabled && audioUnlocked) {
    playBridgeAmbience();
  }
}

export function areGameSoundsMuted(): boolean {
  return soundsMuted;
}

function stopGameSounds(): void {
  for (const clip of audioCache.values()) {
    clip.pause();
    clip.currentTime = 0;
  }
  for (const clip of turnBeepCache.values()) {
    clip.pause();
    clip.currentTime = 0;
  }
  pauseBridgeAmbience();
}

function bridgeAmbienceElement(): HTMLAudioElement {
  if (!bridgeAmbienceClip) {
    bridgeAmbienceClip = new Audio(BRIDGE_AMBIENCE_URL);
    bridgeAmbienceClip.loop = true;
    bridgeAmbienceClip.preload = 'auto';
    bridgeAmbienceClip.volume = BRIDGE_AMBIENCE_VOLUME;
  }
  return bridgeAmbienceClip;
}

function playBridgeAmbience(): void {
  const clip = bridgeAmbienceElement();
  if (clip.paused) {
    void clip.play().catch(() => undefined);
  }
}

function pauseBridgeAmbience(): void {
  if (!bridgeAmbienceClip) {
    return;
  }
  bridgeAmbienceClip.pause();
  bridgeAmbienceClip.currentTime = 0;
}

/** Loop bridge ambience under one-shot table SFX (separate audio element). */
export function setBridgeAmbienceEnabled(enabled: boolean): void {
  bridgeAmbienceEnabled = enabled;
  if (enabled && audioUnlocked && !soundsMuted) {
    playBridgeAmbience();
  } else {
    pauseBridgeAmbience();
  }
}

export function isBridgeAmbienceEnabled(): boolean {
  return bridgeAmbienceEnabled;
}

function audioFor(sound: GameSound): HTMLAudioElement {
  let clip = audioCache.get(sound);
  if (!clip) {
    clip = new Audio(SOUND_URLS[sound]);
    clip.preload = 'auto';
    audioCache.set(sound, clip);
  }
  return clip;
}

/** Prime audio after a user gesture (browser autoplay policy). */
export function unlockGameAudio(): void {
  if (audioUnlocked) {
    return;
  }
  audioUnlocked = true;
  for (const sound of Object.keys(SOUND_URLS) as GameSound[]) {
    const clip = audioFor(sound);
    clip.load();
  }
  bridgeAmbienceElement().load();
  if (bridgeAmbienceEnabled && !soundsMuted) {
    playBridgeAmbience();
  }
}

export function stopGameSound(sound: GameSound): void {
  const clip = audioCache.get(sound);
  if (!clip) {
    return;
  }
  clip.pause();
  clip.currentTime = 0;
}

export function playGameSound(sound: GameSound): void {
  if (!audioUnlocked || soundsMuted) {
    return;
  }
  const clip = audioFor(sound);
  clip.currentTime = 0;
  void clip.play().catch(() => undefined);
}

export function playTurnBeep(url: string): void {
  if (!audioUnlocked || soundsMuted) {
    return;
  }
  let clip = turnBeepCache.get(url);
  if (!clip) {
    clip = new Audio(url);
    clip.preload = 'auto';
    turnBeepCache.set(url, clip);
  }
  clip.currentTime = 0;
  void clip.play().catch(() => undefined);
}
