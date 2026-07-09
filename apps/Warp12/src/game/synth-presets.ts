export interface AmbiencePreset {
  readonly masterGain: number;
  readonly humFreqHz: number;
  readonly humGain: number;
  readonly noiseGain: number;
  readonly noiseFilterHz: number;
  readonly lfoRateHz: number;
  readonly lfoDepth: number;
}

export const BRIDGE_NET_PRESET: AmbiencePreset = {
  masterGain: 0.35,
  humFreqHz: 58,
  humGain: 0.22,
  noiseGain: 0.08,
  noiseFilterHz: 280,
  lfoRateHz: 0.07,
  lfoDepth: 0.04,
};

/** @deprecated use {@link BRIDGE_NET_PRESET} */
export const BRIDGE_AMBIENCE_PRESET = BRIDGE_NET_PRESET;
