/**
 * Musical chirp synthesis — dual-oscillator beeps with pentatonic intervals.
 *
 * Frequencies come from a pentatonic palette; harmonics use perfect intervals only.
 * Waveforms are role-locked (sine = UI, triangle = minor alert, square = red alert).
 */

/** C-major pentatonic (Hz) — any subset harmonizes in any order. */
export const UI_PENTATONIC_HZ = [
  523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1318.51,
] as const;

/** Locked musical harmonic ratios — never use arbitrary decimals. */
export const MUSICAL_INTERVAL = {
  /** Quintessential bright "tech" layer */
  PERFECT_FIFTH: 1.5,
  /** Affirmative / acknowledge */
  MAJOR_THIRD: 1.25,
  /** Suspended / processing / minor alert */
  PERFECT_FOURTH: 4 / 3,
  /** Errors / access denied only */
  DISSONANT: 1.14,
} as const;

/** Your-turn hail fundamental (~466.17 Hz). */
export const HAIL_ACK_HZ = 466.17;

/** Gap between hail trill taps (legacy ~48–52 ms between onsets). */
export const HAIL_TRILL_GAP_SEC = 0.05;

/** Single hail tap — short so rapid repeats read as a trill, not one long tone. */
export const HAIL_HIT_DURATION_SEC = 0.058;

/** Rapid repeats in one hail (~4 taps / ~250 ms total). */
export const HAIL_TRILL_TAP_COUNT = 4;

/** @deprecated Use {@link HAIL_TRILL_GAP_SEC}. */
export const HAIL_STUTTER_GAP_SEC = HAIL_TRILL_GAP_SEC;

/** Double-chart console warning — legacy root (~A3). */
export const CONSOLE_ALERT_HZ = 220;

/** Gap between console stutter hits. */
export const CONSOLE_STUTTER_GAP_SEC = 0.056;

/** Single console tap — short so the double reads as two distinct hits. */
export const CONSOLE_HIT_DURATION_SEC = 0.095;

/** Length of the clean musical sweep */
export const RED_ALERT_DURATION_SEC = 0.42;

/** Total time from one dwoop onset to the next (leaves ~1.6s of breathing room) */
export const RED_ALERT_LOOP_INTERVAL_SEC = 2;

/** Bursts scheduled ahead while red alert is active */
export const RED_ALERT_LOOP_BURSTS = 320;

/** @deprecated Use {@link RED_ALERT_LOOP_INTERVAL_SEC}. */
export const RED_ALERT_BURST_INTERVAL_SEC = RED_ALERT_LOOP_INTERVAL_SEC;

export type ChirpBeepRole = 'chart' | 'hail' | 'console';
export type ChirpWaveType = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface ChirpBeepParams {
  readonly baseFreqHz: number;
  readonly waveType: ChirpWaveType;
  readonly durationSec: number;
  readonly peakGain?: number;
  /** 1 = fundamental only; otherwise a {@link MUSICAL_INTERVAL} multiplier. */
  readonly harmonicOffset: number;
  readonly harmonicGain?: number;
  readonly delaySec?: number;
}

/** Map beep slot 1–77 to pentatonic notes across two octaves (deterministic). */
export function pentatonicHzForSlot(slot: number): number {
  const index = Math.max(1, Math.min(77, slot)) - 1;
  const noteIndex = index % UI_PENTATONIC_HZ.length;
  const octave = Math.floor(index / UI_PENTATONIC_HZ.length) % 2;
  return UI_PENTATONIC_HZ[noteIndex]! * (octave === 0 ? 1 : 2);
}

/** Random pentatonic note — for optional variety when slot is not fixed. */
export function randomPentatonicHz(rng: () => number = Math.random): number {
  const index = Math.floor(rng() * UI_PENTATONIC_HZ.length);
  return UI_PENTATONIC_HZ[index] ?? UI_PENTATONIC_HZ[0]!;
}

/** Chart / data-entry keypress — sine + perfect fifth. */
export function chartBeepParamsForSlot(slot: number): ChirpBeepParams {
  const durationSec = 0.05 + ((slot * 17) % 5) * 0.012;
  return {
    baseFreqHz: pentatonicHzForSlot(slot),
    waveType: 'sine',
    durationSec: Math.max(0.05, Math.min(0.11, durationSec)),
    peakGain: 0.42,
    harmonicOffset: MUSICAL_INTERVAL.PERFECT_FIFTH,
    harmonicGain: 0.25,
  };
}

/** One hail tap — sine fundamental + perfect fifth overtone. */
export function hailHitParams(options?: {
  delaySec?: number;
  peakGain?: number;
  baseFreqHz?: number;
}): ChirpBeepParams {
  return {
    baseFreqHz: options?.baseFreqHz ?? HAIL_ACK_HZ,
    waveType: 'sine',
    durationSec: HAIL_HIT_DURATION_SEC,
    peakGain: options?.peakGain ?? 0.46,
    harmonicOffset: MUSICAL_INTERVAL.PERFECT_FIFTH,
    harmonicGain: 0.18,
    delaySec: options?.delaySec,
  };
}

/**
 * Your-turn hail — four-tap trill on the legacy ~473 Hz pitch.
 */
export function hailBeepSequence(): readonly ChirpBeepParams[] {
  const taps: ChirpBeepParams[] = [];
  for (let i = 0; i < HAIL_TRILL_TAP_COUNT; i += 1) {
    const gain = 0.48 - i * 0.04;
    taps.push(
      hailHitParams({
        delaySec: i === 0 ? undefined : i * HAIL_TRILL_GAP_SEC,
        peakGain: Math.max(0.32, gain),
      })
    );
  }
  return taps;
}

/** @deprecated Prefer {@link hailBeepSequence} — returns the first trill hit only. */
export function hailBeepParams(): ChirpBeepParams {
  return hailHitParams();
}

/** One console double-chart tap — triangle + semitone layer (legacy 220+233). */
export function consoleHitParams(options?: {
  delaySec?: number;
  peakGain?: number;
  waveType?: 'triangle' | 'square';
}): ChirpBeepParams {
  return {
    baseFreqHz: CONSOLE_ALERT_HZ,
    waveType: options?.waveType ?? 'triangle',
    durationSec: CONSOLE_HIT_DURATION_SEC,
    peakGain: options?.peakGain ?? 0.28,
    harmonicOffset: 2 ** (1 / 12),
    harmonicGain: 0.16,
    delaySec: options?.delaySec,
  };
}

/**
 * Double-chart console warning — soft triangle double-tap.
 * (~56 ms between first two onsets.)
 */
export function consoleBeepSequence(): readonly ChirpBeepParams[] {
  return [
    consoleHitParams(),
    consoleHitParams({
      delaySec: CONSOLE_STUTTER_GAP_SEC,
      peakGain: 0.24,
    }),
  ];
}

/** @deprecated Prefer {@link consoleBeepSequence}. */
export function consoleBeepParams(): ChirpBeepParams {
  return consoleHitParams();
}

export interface ChirpLoopHandle {
  stop(): void;
}

/** Looping red alert — elegant, low-to-high musical dwoop pulses. */
export function scheduleChirpRedAlert(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number
): ChirpLoopHandle {
  const nodes: AudioScheduledSourceNode[] = [];

  for (let burst = 0; burst < RED_ALERT_LOOP_BURSTS; burst += 1) {
    const t = startTime + burst * RED_ALERT_LOOP_INTERVAL_SEC;

    // Master envelope for this specific dwoop pulse
    const masterGain = ctx.createGain();
    masterGain.connect(dest);
    masterGain.gain.setValueAtTime(0, t);
    
    // Smooth but definitive fade-in to establish the "dwoop" shape
    masterGain.gain.linearRampToValueAtTime(0.5, t + 0.12);
    // Smoothly coast at peak volume during the crest of the sweep
    masterGain.gain.linearRampToValueAtTime(0.5, t + 0.3);
    // Natural musical decay into the silence gap
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + RED_ALERT_DURATION_SEC);

    // Root frequency setup based on your console alert tone (220Hz)
    const sweepStartHz = CONSOLE_ALERT_HZ; // 220Hz (Deep, clean starting anchor)
    const sweepEndHz = CONSOLE_ALERT_HZ * 1.6; // 352Hz (Sweeps up past a perfect fifth)

    // OSCILLATOR 1: The Fundamental Sine Sweep
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(sweepStartHz, t);
    osc1.frequency.exponentialRampToValueAtTime(sweepEndHz, t + 0.32);
    
    osc1.connect(masterGain);
    osc1.start(t);
    osc1.stop(t + RED_ALERT_DURATION_SEC + 0.05);
    nodes.push(osc1);

    // OSCILLATOR 2: The Suspended Tension Layer
    // Tracks the exact same sweep, but shifted up by a Perfect Fourth (4/3)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    
    const chordOffset = MUSICAL_INTERVAL.PERFECT_FOURTH; // 1.3333...
    osc2.frequency.setValueAtTime(sweepStartHz * chordOffset, t);
    osc2.frequency.exponentialRampToValueAtTime(sweepEndHz * chordOffset, t + 0.32);

    // Tuck the harmony slightly lower so it doesn't pierce
    const harmonyGain = ctx.createGain();
    harmonyGain.gain.setValueAtTime(0.4, t); 
    
    osc2.connect(harmonyGain);
    harmonyGain.connect(masterGain);
    
    osc2.start(t);
    osc2.stop(t + RED_ALERT_DURATION_SEC + 0.05);
    nodes.push(osc2);
  }

  return {
    stop: () => {
      // Clean 50ms fade out if the user clears the alert mid-dwoop
      const end = ctx.currentTime + 0.05;
      for (const node of nodes) {
        try {
          node.stop(end);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

export function chirpBeepParamsForRole(
  role: ChirpBeepRole,
  options?: { slot?: number }
): ChirpBeepParams {
  if (role === 'chart') {
    return chartBeepParamsForSlot(options?.slot ?? 1);
  }
  if (role === 'hail') {
    return hailHitParams();
  }
  return consoleHitParams();
}

/** Schedule one musical chirp into `dest`. */
export function scheduleChirpBeep(
  ctx: AudioContext,
  dest: AudioNode,
  params: ChirpBeepParams,
  startTime: number
): AudioScheduledSourceNode[] {
  const t = startTime + (params.delaySec ?? 0);
  const durationSec = params.durationSec;
  const peakGain = params.peakGain ?? 0.5;
  const nodes: AudioScheduledSourceNode[] = [];

  const masterGain = ctx.createGain();
  masterGain.connect(dest);
  masterGain.gain.setValueAtTime(0, t);
  masterGain.gain.linearRampToValueAtTime(peakGain, t + 0.01);
  masterGain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

  const osc1 = ctx.createOscillator();
  osc1.type = params.waveType;
  osc1.frequency.setValueAtTime(params.baseFreqHz, t);
  osc1.connect(masterGain);
  osc1.start(t);
  osc1.stop(t + durationSec + 0.02);
  nodes.push(osc1);

  if (params.harmonicOffset !== 1) {
    const osc2 = ctx.createOscillator();
    osc2.type = params.waveType;
    osc2.frequency.setValueAtTime(
      params.baseFreqHz * params.harmonicOffset,
      t
    );
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(params.harmonicGain ?? 0.25, t);
    osc2.connect(subGain);
    subGain.connect(masterGain);
    osc2.start(t);
    osc2.stop(t + durationSec + 0.02);
    nodes.push(osc2);
  }

  return nodes;
}

export function scheduleChirpBeeps(
  ctx: AudioContext,
  dest: AudioNode,
  role: ChirpBeepRole,
  options?: { slot?: number; startTime?: number }
): void {
  const startTime = options?.startTime ?? ctx.currentTime;
  if (role === 'hail') {
    for (const params of hailBeepSequence()) {
      scheduleChirpBeep(ctx, dest, params, startTime);
    }
    return;
  }
  if (role === 'console') {
    for (const params of consoleBeepSequence()) {
      scheduleChirpBeep(ctx, dest, params, startTime);
    }
    return;
  }
  const params = chirpBeepParamsForRole(role, options);
  scheduleChirpBeep(ctx, dest, params, startTime);
}
