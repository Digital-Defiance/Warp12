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

/**
 * Pink (1/f) or brown (1/f²) noise for ambience beds.
 * Pink ≈ ducted air; brown ≈ distant hull rumble.
 */
export function createColoredNoiseBuffer(
  ctx: AudioContext,
  color: 'pink' | 'brown',
  durationSec = WARP_NOISE_BUFFER_SEC
): AudioBuffer {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);

  if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = Math.max(-1, Math.min(1, last + white * 0.02));
      output[i] = last * 3.5;
    }
    return buffer;
  }

  // Paul Kellet refined pink-noise filter.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    output[i] = pink * 0.11;
  }
  return buffer;
}

/** Return to warp — cinematic engine swell with harmonic richness + opening spatial whoosh. */
export function scheduleWarpEngage(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number
): WarpSynthHandle {
  const t = startTime;
  const nodes: AudioScheduledSourceNode[] = [];

  // Primary engine swell — smooth sine wave climb from sub-bass to mid-range.
  const engineOsc = ctx.createOscillator();
  engineOsc.type = 'sine';
  engineOsc.frequency.setValueAtTime(35, t);
  engineOsc.frequency.exponentialRampToValueAtTime(250, t + 1.4);

  const engineGain = ctx.createGain();
  engineGain.gain.setValueAtTime(0, t);
  engineGain.gain.linearRampToValueAtTime(0.6, t + 1.1);
  engineGain.gain.exponentialRampToValueAtTime(0.01, t + 1.7);

  engineOsc.connect(engineGain);
  engineGain.connect(dest);
  engineOsc.start(t);
  engineOsc.stop(t + WARP_ENGAGE_DURATION_SEC);
  nodes.push(engineOsc);

  // Harmonic layer — adds warmth and complexity to the swell.
  const harmonicOsc = ctx.createOscillator();
  harmonicOsc.type = 'sine';
  harmonicOsc.frequency.setValueAtTime(52, t); // Fifth harmonic relationship
  harmonicOsc.frequency.exponentialRampToValueAtTime(375, t + 1.4);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0, t);
  harmonicGain.gain.linearRampToValueAtTime(0.35, t + 1.2);
  harmonicGain.gain.exponentialRampToValueAtTime(0.01, t + 1.7);

  harmonicOsc.connect(harmonicGain);
  harmonicGain.connect(dest);
  harmonicOsc.start(t);
  harmonicOsc.stop(t + WARP_ENGAGE_DURATION_SEC);
  nodes.push(harmonicOsc);

  // Sub-bass punch — adds physical impact to the engagement.
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(28, t);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0, t);
  subGain.gain.linearRampToValueAtTime(0.5, t + 0.8);
  subGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

  subOsc.connect(subGain);
  subGain.connect(dest);
  subOsc.start(t);
  subOsc.stop(t + WARP_ENGAGE_DURATION_SEC);
  nodes.push(subOsc);

  // Spatial whoosh — opening highpass sweep for warp field expansion.
  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(120, t);
  filter.frequency.exponentialRampToValueAtTime(2500, t + 1.3);
  filter.Q.setValueAtTime(1.8, t);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(0.55, t + 1.1);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 1.7);

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

/** Drop to impulse — cinematic engine wind-down with harmonic decay, closing spatial field, settling bass rumble. */
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

  // Primary engine wind-down — smooth descent from mid to sub-bass.
  const engineOsc = ctx.createOscillator();
  engineOsc.type = 'sine';
  engineOsc.frequency.setValueAtTime(220, t);
  engineOsc.frequency.exponentialRampToValueAtTime(38, t + 2.8);

  const engineGain = ctx.createGain();
  engineGain.gain.setValueAtTime(0.45, t);
  engineGain.gain.linearRampToValueAtTime(0.35, t + 1.5);
  engineGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  engineOsc.connect(engineGain);
  engineGain.connect(masterGain);
  engineOsc.start(t);
  engineOsc.stop(t + duration);
  nodes.push(engineOsc);

  // Harmonic layer — adds complexity to the wind-down.
  const harmonicOsc = ctx.createOscillator();
  harmonicOsc.type = 'sine';
  harmonicOsc.frequency.setValueAtTime(165, t);
  harmonicOsc.frequency.exponentialRampToValueAtTime(30, t + 2.8);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0.28, t);
  harmonicGain.gain.linearRampToValueAtTime(0.18, t + 1.5);
  harmonicGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  harmonicOsc.connect(harmonicGain);
  harmonicGain.connect(masterGain);
  harmonicOsc.start(t);
  harmonicOsc.stop(t + duration);
  nodes.push(harmonicOsc);

  // Upper harmonic — adds shimmer to the initial drop moment.
  const upperOsc = ctx.createOscillator();
  upperOsc.type = 'sine';
  upperOsc.frequency.setValueAtTime(330, t);
  upperOsc.frequency.exponentialRampToValueAtTime(60, t + 2.2);

  const upperGain = ctx.createGain();
  upperGain.gain.setValueAtTime(0.15, t);
  upperGain.gain.exponentialRampToValueAtTime(0.01, t + 2.5);

  upperOsc.connect(upperGain);
  upperGain.connect(masterGain);
  upperOsc.start(t);
  upperOsc.stop(t + duration);
  nodes.push(upperOsc);

  // Warp field collapse — closing bandpass sweep with character.
  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(ctx);
  noiseNode.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(1800, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(140, t + 3);
  noiseFilter.Q.setValueAtTime(2, t);
  noiseFilter.Q.linearRampToValueAtTime(1.2, t + 2);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, t);
  noiseGain.gain.linearRampToValueAtTime(0.3, t + 2);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

  noiseNode.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseNode.start(t);
  noiseNode.stop(t + duration);
  nodes.push(noiseNode);

  // Hull settling rumble — physical resonance as the ship transitions.
  const rumbleOsc = ctx.createOscillator();
  rumbleOsc.type = 'sine';
  rumbleOsc.frequency.setValueAtTime(42, t);
  rumbleOsc.frequency.linearRampToValueAtTime(38, t + 2);

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.01, t);
  rumbleGain.gain.linearRampToValueAtTime(0.48, t + 1.4);
  rumbleGain.gain.linearRampToValueAtTime(0.35, t + 2.5);
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

/** All Stop — cinematic power-down with harmonic spin-down, filtered ambient decay, and resonant hull thud. */
export function scheduleAllStop(
  ctx: AudioContext,
  dest: AudioNode,
  startTime: number
): WarpSynthHandle {
  const t = startTime;
  const duration = ALL_STOP_DURATION_SEC;
  const nodes: AudioScheduledSourceNode[] = [];

  // Primary core spin-down — smooth sine descent from mid to deep sub-bass.
  const coreOsc = ctx.createOscillator();
  coreOsc.type = 'sine';
  coreOsc.frequency.setValueAtTime(140, t);
  coreOsc.frequency.exponentialRampToValueAtTime(22, t + duration - 0.3);

  const coreGain = ctx.createGain();
  coreGain.gain.setValueAtTime(0.42, t);
  coreGain.gain.linearRampToValueAtTime(0.35, t + 2);
  coreGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  coreOsc.connect(coreGain);
  coreGain.connect(dest);

  // Harmonic layer — adds warmth to the power-down.
  const harmonicOsc = ctx.createOscillator();
  harmonicOsc.type = 'sine';
  harmonicOsc.frequency.setValueAtTime(105, t);
  harmonicOsc.frequency.exponentialRampToValueAtTime(18, t + duration - 0.3);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0.28, t);
  harmonicGain.gain.linearRampToValueAtTime(0.22, t + 2);
  harmonicGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  harmonicOsc.connect(harmonicGain);
  harmonicGain.connect(dest);

  // Upper shimmer — adds character to the initial shutdown moment.
  const upperOsc = ctx.createOscillator();
  upperOsc.type = 'sine';
  upperOsc.frequency.setValueAtTime(210, t);
  upperOsc.frequency.exponentialRampToValueAtTime(35, t + duration - 1);

  const upperGain = ctx.createGain();
  upperGain.gain.setValueAtTime(0.18, t);
  upperGain.gain.exponentialRampToValueAtTime(0.001, t + duration - 0.5);

  upperOsc.connect(upperGain);
  upperGain.connect(dest);

  // Atmospheric wind-down — filtered noise for ambient decay.
  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(ctx, duration);

  const spinFilter = ctx.createBiquadFilter();
  spinFilter.type = 'bandpass';
  spinFilter.frequency.setValueAtTime(1200, t);
  spinFilter.frequency.exponentialRampToValueAtTime(60, t + duration - 0.5);
  spinFilter.Q.setValueAtTime(1.8, t);
  spinFilter.Q.linearRampToValueAtTime(1, t + 3);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.32, t);
  noiseGain.gain.linearRampToValueAtTime(0.18, t + 2.5);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  noiseNode.connect(spinFilter);
  spinFilter.connect(noiseGain);
  noiseGain.connect(dest);

  // Final hull thud — deeper and more resonant with a slight pitch drop.
  const thudOsc = ctx.createOscillator();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(50, t + duration - 0.35);
  thudOsc.frequency.linearRampToValueAtTime(28, t + duration - 0.05);

  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.55, t + duration - 0.35);
  thudGain.gain.linearRampToValueAtTime(0.65, t + duration - 0.15);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + duration + 0.3);

  thudOsc.connect(thudGain);
  thudGain.connect(dest);

  coreOsc.start(t);
  harmonicOsc.start(t);
  upperOsc.start(t);
  noiseNode.start(t);
  thudOsc.start(t + duration - 0.35);

  coreOsc.stop(t + duration);
  harmonicOsc.stop(t + duration);
  upperOsc.stop(t + duration);
  noiseNode.stop(t + duration);
  thudOsc.stop(t + duration + 0.3);

  nodes.push(coreOsc, harmonicOsc, upperOsc, noiseNode, thudOsc);

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
