/**
 * Musical warp transition synthesis — engage (return to warp) and drop (impulse).
 *
 * Layered triangle/sine oscillators with swept pitch envelopes plus filtered
 * white noise for the spatial whoosh.
 */

/** White-noise buffer length — long enough to loop under drop-to-impulse. */
export const WARP_NOISE_BUFFER_SEC = 3;

export const WARP_ENGAGE_DURATION_SEC = 2;
export const WARP_DROP_DURATION_SEC = 4;

/** Extended duration for a slow, cinematic All Stop spin-down. */
export const ALL_STOP_DURATION_SEC = 5;

/** Continuum Flash — fast upward whine + micro whoosh (~0.5 s). */
export const CONTINUUM_FLASH_DURATION_SEC = 0.5;
export const CONTINUUM_FLASH_ENGINE_START_HZ = 800;
export const CONTINUUM_FLASH_ENGINE_END_HZ = 5000;
export const CONTINUUM_FLASH_ENGINE_SWEEP_SEC = 0.25;
export const CONTINUUM_FLASH_NOISE_FILTER_START_HZ = 500;
export const CONTINUUM_FLASH_NOISE_FILTER_END_HZ = 6000;
export const CONTINUUM_FLASH_NOISE_FILTER_SWEEP_SEC = 0.2;
export const CONTINUUM_FLASH_SWELL_SEC = 0.1;
export const CONTINUUM_FLASH_DECAY_END_SEC = 0.4;

export interface WarpSynthHandle {
  readonly nodes: readonly AudioScheduledSourceNode[];
  stop(): void;
}

/** Mono white-noise buffer for warp spatial layers. */
export function createNoiseBuffer(
  ctx: AudioContext,
  durationSec = WARP_NOISE_BUFFER_SEC
): AudioBuffer {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Return to warp — sub-bass swell + opening lowpass whoosh. */
export function scheduleWarpEngage(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number
): WarpSynthHandle {
  const t = startTime;
  const nodes: AudioScheduledSourceNode[] = [];

  const engineOsc = ctx.createOscillator();
  engineOsc.type = 'triangle';
  engineOsc.frequency.setValueAtTime(30, t);
  engineOsc.frequency.exponentialRampToValueAtTime(300, t + 1.5);

  const engineGain = ctx.createGain();
  engineGain.gain.setValueAtTime(0, t);
  engineGain.gain.linearRampToValueAtTime(0.8, t + 1.2);
  engineGain.gain.exponentialRampToValueAtTime(0.01, t + 1.6);

  engineOsc.connect(engineGain);
  engineGain.connect(dest);
  engineOsc.start(t);
  engineOsc.stop(t + WARP_ENGAGE_DURATION_SEC);
  nodes.push(engineOsc);

  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(100, t);
  filter.frequency.exponentialRampToValueAtTime(2000, t + 1.2);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(0.5, t + 1.2);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 1.6);

  noiseNode.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseNode.start(t);
  noiseNode.stop(t + WARP_ENGAGE_DURATION_SEC);
  nodes.push(noiseNode);

  return {
    nodes,
    stop: () => stopWarpNodes(ctx, nodes),
  };
}

/** Drop to impulse — descending whine, closing noise wash, settling bass rumble. */
export function scheduleWarpDrop(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number
): WarpSynthHandle {
  const t = startTime;
  const duration = WARP_DROP_DURATION_SEC;
  const nodes: AudioScheduledSourceNode[] = [];

  const masterGain = ctx.createGain();
  masterGain.connect(dest);
  masterGain.gain.setValueAtTime(1, t);

  const whineOsc = ctx.createOscillator();
  whineOsc.type = 'triangle';
  whineOsc.frequency.setValueAtTime(400, t);
  whineOsc.frequency.exponentialRampToValueAtTime(40, t + 3);

  const whineGain = ctx.createGain();
  whineGain.gain.setValueAtTime(0.7, t);
  whineGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  whineOsc.connect(whineGain);
  whineGain.connect(masterGain);
  whineOsc.start(t);
  whineOsc.stop(t + duration);
  nodes.push(whineOsc);

  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(ctx);
  noiseNode.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(2000, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 3);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, t);
  noiseGain.gain.linearRampToValueAtTime(0.01, t + duration);

  noiseNode.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseNode.start(t);
  noiseNode.stop(t + duration);
  nodes.push(noiseNode);

  const rumbleOsc = ctx.createOscillator();
  rumbleOsc.type = 'sine';
  rumbleOsc.frequency.setValueAtTime(50, t);

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.01, t);
  rumbleGain.gain.linearRampToValueAtTime(0.6, t + 1.5);
  rumbleGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  rumbleOsc.connect(rumbleGain);
  rumbleGain.connect(masterGain);
  rumbleOsc.start(t);
  rumbleOsc.stop(t + duration);
  nodes.push(rumbleOsc);

  return {
    nodes,
    stop: () => stopWarpNodes(ctx, nodes),
  };
}

/** Continuum Flash — violent upward engine sweep + opening noise whoosh. */
export function scheduleContinuumFlash(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number
): WarpSynthHandle {
  const t = startTime;
  const duration = CONTINUUM_FLASH_DURATION_SEC;
  const nodes: AudioScheduledSourceNode[] = [];

  const masterGain = ctx.createGain();
  masterGain.connect(dest);
  masterGain.gain.setValueAtTime(1, t);

  const engineOsc = ctx.createOscillator();
  engineOsc.type = 'triangle';
  engineOsc.frequency.setValueAtTime(CONTINUUM_FLASH_ENGINE_START_HZ, t);
  engineOsc.frequency.exponentialRampToValueAtTime(
    CONTINUUM_FLASH_ENGINE_END_HZ,
    t + CONTINUUM_FLASH_ENGINE_SWEEP_SEC
  );

  const engineGain = ctx.createGain();
  engineGain.gain.setValueAtTime(0, t);
  engineGain.gain.linearRampToValueAtTime(0.8, t + CONTINUUM_FLASH_SWELL_SEC);
  engineGain.gain.exponentialRampToValueAtTime(0.01, t + CONTINUUM_FLASH_DECAY_END_SEC);

  engineOsc.connect(engineGain);
  engineGain.connect(masterGain);
  engineOsc.start(t);
  engineOsc.stop(t + duration);
  nodes.push(engineOsc);

  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(ctx);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(CONTINUUM_FLASH_NOISE_FILTER_START_HZ, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(
    CONTINUUM_FLASH_NOISE_FILTER_END_HZ,
    t + CONTINUUM_FLASH_NOISE_FILTER_SWEEP_SEC
  );

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(1, t + CONTINUUM_FLASH_SWELL_SEC);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + CONTINUUM_FLASH_DECAY_END_SEC);

  noiseNode.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseNode.start(t);
  noiseNode.stop(t + duration);
  nodes.push(noiseNode);

  return {
    nodes,
    stop: () => stopWarpNodes(ctx, nodes),
  };
}

/** All Stop — slow resonant spin-down, ambient wind, and final hull thud. */
export function scheduleAllStop(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number
): WarpSynthHandle {
  const t = startTime;
  const duration = ALL_STOP_DURATION_SEC;
  const nodes: AudioScheduledSourceNode[] = [];

  const coreOsc = ctx.createOscillator();
  coreOsc.type = 'triangle';
  coreOsc.frequency.setValueAtTime(120, t);
  coreOsc.frequency.exponentialRampToValueAtTime(20, t + duration);

  const coreGain = ctx.createGain();
  coreGain.gain.setValueAtTime(0.4, t);
  coreGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  coreOsc.connect(coreGain);
  coreGain.connect(dest);

  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(ctx, duration);

  const spinFilter = ctx.createBiquadFilter();
  spinFilter.type = 'lowpass';
  spinFilter.frequency.setValueAtTime(1500, t);
  spinFilter.frequency.exponentialRampToValueAtTime(50, t + duration);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  noiseNode.connect(spinFilter);
  spinFilter.connect(noiseGain);
  noiseGain.connect(dest);

  const thudOsc = ctx.createOscillator();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(40, t + duration - 0.2);
  thudOsc.frequency.linearRampToValueAtTime(20, t + duration);

  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.5, t + duration - 0.2);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  thudOsc.connect(thudGain);
  thudGain.connect(dest);

  coreOsc.start(t);
  noiseNode.start(t);
  thudOsc.start(t + duration - 0.2);

  coreOsc.stop(t + duration);
  noiseNode.stop(t + duration);
  thudOsc.stop(t + duration);

  nodes.push(coreOsc, noiseNode, thudOsc);

  return {
    nodes,
    stop: () => stopWarpNodes(ctx, nodes),
  };
}

function stopWarpNodes(
  ctx: AudioContext,
  nodes: readonly AudioScheduledSourceNode[]
): void {
  const end = ctx.currentTime + 0.03;
  for (const node of nodes) {
    try {
      node.stop(end);
    } catch {
      /* already stopped */
    }
  }
}
