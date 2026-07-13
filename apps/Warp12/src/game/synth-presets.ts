export type AmbienceNoiseColor = 'pink' | 'brown';

/**
 * Bridge ambience — life-support air + a soft breathing engine bed.
 * Avoids (1) pure sub-bass sine drones that boom on tablet speakers and
 * (2) open white noise that reads as a waterfall.
 */
export interface AmbiencePreset {
  readonly masterGain: number;
  /** Soft triangle “reactor” fundamental (Hz). */
  readonly engineFreqHz: number;
  readonly engineGain: number;
  /** Quiet upper partial of the engine bed. */
  readonly engineHarmonicRatio: number;
  readonly engineHarmonicGain: number;
  /** Slow amplitude breathe on the engine layer. */
  readonly engineLfoRateHz: number;
  readonly engineLfoDepth: number;
  readonly noiseGain: number;
  readonly noiseColor: AmbienceNoiseColor;
  /** Band-limit the air bed (ducted ventilation, not waterfall hiss). */
  readonly noiseHighpassHz: number;
  readonly noiseLowpassHz: number;
}

/** Default bridge net — soft ship interior, mobile-speaker friendly. */
export const BRIDGE_NET_PRESET: AmbiencePreset = {
  masterGain: 0.34,
  engineFreqHz: 98,
  engineGain: 0.05,
  engineHarmonicRatio: 1.5,
  engineHarmonicGain: 0.016,
  engineLfoRateHz: 0.09,
  engineLfoDepth: 0.32,
  noiseGain: 0.13,
  noiseColor: 'pink',
  noiseHighpassHz: 90,
  noiseLowpassHz: 240,
};

/** @deprecated use {@link BRIDGE_NET_PRESET} */
export const BRIDGE_AMBIENCE_PRESET = BRIDGE_NET_PRESET;
