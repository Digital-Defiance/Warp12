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
  createColoredNoiseBuffer,
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
    if (sound === 'wormhole') {
      this.playWormhole(options?.delayMs ?? 0);
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

  /** Wormhole — bidirectional spatial whoosh (simultaneous engage + drop). */
  playWormhole(delayMs = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    const startTime = ctx.currentTime + delayMs / 1000;
    
    const duration = 1.5;
    
    // Ascending whoosh (warp engage direction) - someone entering
    const noiseUp = ctx.createBufferSource();
    noiseUp.buffer = createNoiseBuffer(ctx);
    
    const filterUp = ctx.createBiquadFilter();
    filterUp.type = 'bandpass';
    filterUp.frequency.setValueAtTime(100, startTime);
    filterUp.frequency.exponentialRampToValueAtTime(3000, startTime + duration);
    filterUp.Q.setValueAtTime(2, startTime);
    
    const gainUp = ctx.createGain();
    gainUp.gain.setValueAtTime(0, startTime);
    gainUp.gain.linearRampToValueAtTime(0.5, startTime + 0.3);
    gainUp.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    noiseUp.connect(filterUp);
    filterUp.connect(gainUp);
    gainUp.connect(master);
    noiseUp.start(startTime);
    noiseUp.stop(startTime + duration);
    
    // Descending whoosh (warp drop direction) - someone exiting
    const noiseDown = ctx.createBufferSource();
    noiseDown.buffer = createNoiseBuffer(ctx);
    
    const filterDown = ctx.createBiquadFilter();
    filterDown.type = 'bandpass';
    filterDown.frequency.setValueAtTime(2800, startTime);
    filterDown.frequency.exponentialRampToValueAtTime(110, startTime + duration);
    filterDown.Q.setValueAtTime(2, startTime);
    
    const gainDown = ctx.createGain();
    gainDown.gain.setValueAtTime(0, startTime);
    gainDown.gain.linearRampToValueAtTime(0.5, startTime + 0.3);
    gainDown.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    noiseDown.connect(filterDown);
    filterDown.connect(gainDown);
    gainDown.connect(master);
    noiseDown.start(startTime);
    noiseDown.stop(startTime + duration);
    
    // Add low frequency rumble for spatial distortion
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(40, startTime);
    rumble.frequency.exponentialRampToValueAtTime(35, startTime + duration / 2);
    rumble.frequency.exponentialRampToValueAtTime(40, startTime + duration);
    
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, startTime);
    rumbleGain.gain.linearRampToValueAtTime(0.4, startTime + 0.2);
    rumbleGain.gain.linearRampToValueAtTime(0.4, startTime + duration - 0.3);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    rumble.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start(startTime);
    rumble.stop(startTime + duration + 0.1);
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

    const stoppers: Array<() => void> = [];
    const startedAt = ctx.currentTime;

    const startOsc = (
      type: OscillatorType,
      freqHz: number,
      gainValue: number,
      lfoDepth: number
    ) => {
      if (gainValue <= 0) {
        return;
      }
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freqHz;
      const gain = ctx.createGain();
      gain.gain.value = gainValue;

      if (lfoDepth > 0 && preset.engineLfoRateHz > 0) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = preset.engineLfoRateHz;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = gainValue * lfoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(startedAt);
        stoppers.push(() => {
          try {
            lfo.stop(ctx.currentTime + 0.05);
          } catch {
            /* already stopped */
          }
        });
      }

      osc.connect(gain);
      gain.connect(master);
      osc.start(startedAt);
      stoppers.push(() => {
        try {
          osc.stop(ctx.currentTime + 0.05);
        } catch {
          /* already stopped */
        }
      });
    };

    // Soft triangle bed — breathes via LFO so it doesn’t read as a fixed drone.
    startOsc('triangle', preset.engineFreqHz, preset.engineGain, preset.engineLfoDepth);
    startOsc(
      'triangle',
      preset.engineFreqHz * preset.engineHarmonicRatio,
      preset.engineHarmonicGain,
      preset.engineLfoDepth * 0.7
    );

    if (preset.noiseGain > 0) {
      const noise = createColoredNoiseBuffer(ctx, preset.noiseColor, 4);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noise;
      noiseSource.loop = true;

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = preset.noiseHighpassHz;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = preset.noiseLowpassHz;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = preset.noiseGain;

      noiseSource.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(noiseGain);
      noiseGain.connect(master);
      noiseSource.start(startedAt);
      stoppers.push(() => {
        try {
          noiseSource.stop(ctx.currentTime + 0.05);
        } catch {
          /* already stopped */
        }
      });
    }

    this.ambienceHandle = {
      stop: () => {
        for (const stop of stoppers) {
          stop();
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
