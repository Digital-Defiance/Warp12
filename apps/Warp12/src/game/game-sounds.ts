export type GameSound = 'hail' | 'consoleWarning' | 'redAlert' | 'warpExit' | 'qFlash';

const SOUND_URLS: Record<GameSound, string> = {
  hail: '/hailbeep.mp3',
  consoleWarning: '/consolewarning.mp3',
  redAlert: '/redalert.mp3',
  warpExit: '/tng_warp_exit.mp3',
  qFlash: '/qflash.mp3',
};

const audioCache = new Map<GameSound, HTMLAudioElement>();
const turnBeepCache = new Map<string, HTMLAudioElement>();
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
