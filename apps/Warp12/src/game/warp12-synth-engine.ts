import {
  BRIDGE_NET_PRESET,
  type AmbiencePreset,
} from './synth-presets.js';
import type { GameSound } from './game-sounds.js';
import {
  scheduleChirpBeeps,
  scheduleChirpRedAlert,
  type ChirpBeepRole,
} from './musical-chirp-synth.js';
import {
  ALL_STOP_DURATION_SEC,
  createNoiseBuffer,
  scheduleAllStop,
  scheduleContinuumFlash,
  scheduleWarpDrop,
  scheduleWarpEngage,
} from './musical-warp-synth.js';

export interface SynthHandle {
  stop(): void;
}

export class Warp12SynthEngine {
  private ctx: AudioContext | null = null;
  private ambienceHandle: SynthHandle | null = null;
  private ambienceMasterGain: GainNode | null = null;
  private ambienceFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly looping = new Map<GameSound, SynthHandle>();

  ensureContext(): AudioContext | null {
    if (typeof globalThis.AudioContext === 'undefined') {
      return null;
    }
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  resetForTests(): void {
    this.stopAmbience();
    for (const sound of this.looping.keys()) {
      this.stopGameSound(sound);
    }
    this.looping.clear();
    void this.ctx?.close();
    this.ctx = null;
  }

  playGameSound(sound: GameSound, options?: { delayMs?: number }): void {
    this.stopGameSound(sound);
    if (sound === 'hail') {
      this.playChirpBeep('hail', 1, options?.delayMs ?? 0);
      return;
    }
    if (sound === 'consoleWarning') {
      this.playChirpBeep('console', 1, options?.delayMs ?? 0);
      return;
    }
    if (sound === 'redAlert') {
      const handle = this.playChirpRedAlert(options?.delayMs ?? 0);
      if (handle) {
        this.looping.set(sound, handle);
      }
      return;
    }
    if (sound === 'returnToWarp') {
      this.playWarpEngage(options?.delayMs ?? 0);
      return;
    }
    if (sound === 'dropToImpulse') {
      this.playWarpDrop(options?.delayMs ?? 0);
      return;
    }
    if (sound === 'flash') {
      this.playContinuumFlash(options?.delayMs ?? 0);
      return;
    }
    if (sound === 'allStop') {
      this.playAllStop(options?.delayMs ?? 0);
      return;
    }
  }

  stopGameSound(sound: GameSound): void {
    const handle = this.looping.get(sound);
    if (!handle) {
      return;
    }
    handle.stop();
    this.looping.delete(sound);
  }

  playTurnBeep(beepId: number, delayMs = 0): void {
    this.playChirpBeep('chart', beepId, delayMs);
  }

  /** Musical dual-oscillator chirps — chart / hail / console. */
  playChirpBeep(role: ChirpBeepRole, slot = 1, delayMs = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    const startTime = ctx.currentTime + delayMs / 1000;
    scheduleChirpBeeps(ctx, master, role, { slot, startTime });
  }

  /** Looping red alert — gentle klaxon double-taps. */
  playChirpRedAlert(delayMs = 0): SynthHandle | null {
    const ctx = this.ensureContext();
    if (!ctx) {
      return null;
    }
    const master = ctx.createGain();
    master.gain.value = 0.72;
    master.connect(ctx.destination);
    const startTime = ctx.currentTime + delayMs / 1000;
    const loop = scheduleChirpRedAlert(ctx, master, startTime);
    return {
      stop: () => {
        loop.stop();
        master.disconnect();
      },
    };
  }

  /** Return to warp — engine swell + spatial whoosh. */
  playWarpEngage(delayMs = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    const startTime = ctx.currentTime + delayMs / 1000;
    scheduleWarpEngage(ctx, master, startTime);
  }

  /** Drop to impulse — descending whine + settling rumble. */
  playWarpDrop(delayMs = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    const startTime = ctx.currentTime + delayMs / 1000;
    scheduleWarpDrop(ctx, master, startTime);
  }

  /** Continuum Flash — fast upward whine + spatial whoosh. */
  playContinuumFlash(delayMs = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    const startTime = ctx.currentTime + delayMs / 1000;
    scheduleContinuumFlash(ctx, master, startTime);
  }

  /** All Stop — slow spin-down while bridge ambience fades out. */
  playAllStop(delayMs = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    this.fadeAmbience(ALL_STOP_DURATION_SEC);
    const startTime = ctx.currentTime + delayMs / 1000;
    scheduleAllStop(ctx, ctx.destination, startTime);
  }

  /** Ramp bridge ambience down over `durationSec` (e.g. during All Stop). */
  fadeAmbience(durationSec: number): void {
    const ctx = this.ctx;
    const master = this.ambienceMasterGain;
    if (!ctx || !master || !this.ambienceHandle) {
      return;
    }
    if (this.ambienceFadeTimer !== null) {
      clearTimeout(this.ambienceFadeTimer);
      this.ambienceFadeTimer = null;
    }
    const t = ctx.currentTime;
    const level = Math.max(master.gain.value, 0.001);
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(level, t);
    master.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
    this.ambienceFadeTimer = setTimeout(() => {
      this.ambienceFadeTimer = null;
      this.stopAmbience();
    }, durationSec * 1000 + 80);
  }

  startAmbience(preset: AmbiencePreset = BRIDGE_NET_PRESET): void {
    this.stopAmbience();
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const master = ctx.createGain();
    master.gain.value = preset.masterGain;
    master.connect(ctx.destination);
    this.ambienceMasterGain = master;

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = preset.humFreqHz;
    const humGain = ctx.createGain();
    humGain.gain.value = preset.humGain;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = preset.lfoRateHz;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = preset.humGain * preset.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(humGain.gain);

    hum.connect(humGain);
    humGain.connect(master);

    const noise = this.createNoiseBuffer(ctx, 4);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    noiseSource.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = preset.noiseFilterHz;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = preset.noiseGain;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    const startedAt = ctx.currentTime;
    hum.start(startedAt);
    lfo.start(startedAt);
    noiseSource.start(startedAt);

    this.ambienceHandle = {
      stop: () => {
        const end = ctx.currentTime + 0.05;
        try {
          hum.stop(end);
          lfo.stop(end);
          noiseSource.stop(end);
        } catch {
          /* already stopped */
        }
        master.disconnect();
      },
    };
  }

  stopAmbience(): void {
    if (this.ambienceFadeTimer !== null) {
      clearTimeout(this.ambienceFadeTimer);
      this.ambienceFadeTimer = null;
    }
    this.ambienceHandle?.stop();
    this.ambienceHandle = null;
    this.ambienceMasterGain = null;
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    return createNoiseBuffer(ctx, durationSec);
  }
}

let engine: Warp12SynthEngine | null = null;

export function getWarp12SynthEngine(): Warp12SynthEngine {
  if (!engine) {
    engine = new Warp12SynthEngine();
  }
  return engine;
}

export function resetWarp12SynthEngineForTests(): void {
  engine?.resetForTests();
  engine = null;
}
