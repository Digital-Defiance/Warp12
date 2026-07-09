import { describe, expect, it } from 'vitest';

import {
  chartBeepParamsForSlot,
  consoleBeepSequence,
  CONSOLE_ALERT_HZ,
  CONSOLE_STUTTER_GAP_SEC,
  hailBeepSequence,
  HAIL_ACK_HZ,
  HAIL_TRILL_GAP_SEC,
  HAIL_TRILL_TAP_COUNT,
  MUSICAL_INTERVAL,
  pentatonicHzForSlot,
  RED_ALERT_BURST_INTERVAL_SEC,
  RED_ALERT_DURATION_SEC,
  RED_ALERT_LOOP_INTERVAL_SEC,
  UI_PENTATONIC_HZ,
} from './musical-chirp-synth.js';

function isOnPentatonicScale(hz: number): boolean {
  return UI_PENTATONIC_HZ.some(
    (note) => note === hz || note * 2 === hz
  );
}

describe('musical chirp synth', () => {
  it('chart keypress uses pentatonic sine + perfect fifth', () => {
    const params = chartBeepParamsForSlot(5);
    expect(isOnPentatonicScale(params.baseFreqHz)).toBe(true);
    expect(params.waveType).toBe('sine');
    expect(params.harmonicOffset).toBe(MUSICAL_INTERVAL.PERFECT_FIFTH);
    expect(params.durationSec).toBeGreaterThanOrEqual(0.05);
    expect(params.durationSec).toBeLessThanOrEqual(0.11);
  });

  it('pentatonic slot mapping stays on scale across octaves', () => {
    const low = pentatonicHzForSlot(1);
    const high = pentatonicHzForSlot(8);
    expect(UI_PENTATONIC_HZ).toContain(low);
    expect(high).toBe(low * 2);
  });

  it('hail is a four-tap trill on the legacy fundamental + perfect fifth', () => {
    const hits = hailBeepSequence();
    expect(hits).toHaveLength(HAIL_TRILL_TAP_COUNT);
    expect(hits[0]!.baseFreqHz).toBe(HAIL_ACK_HZ);
    expect(hits[0]!.waveType).toBe('sine');
    expect(hits[0]!.harmonicOffset).toBe(MUSICAL_INTERVAL.PERFECT_FIFTH);
    expect(hits[1]!.delaySec).toBe(HAIL_TRILL_GAP_SEC);
    expect(hits[2]!.delaySec).toBe(HAIL_TRILL_GAP_SEC * 2);
    expect(hits[3]!.delaySec).toBe(HAIL_TRILL_GAP_SEC * 3);
    expect(hits[3]!.peakGain!).toBeLessThan(hits[0]!.peakGain!);
  });

  it('console double is a soft triangle stutter on A3 + semitone', () => {
    const hits = consoleBeepSequence();
    expect(hits).toHaveLength(2);
    expect(hits[0]!.baseFreqHz).toBe(CONSOLE_ALERT_HZ);
    expect(hits[0]!.waveType).toBe('triangle');
    expect(hits[0]!.harmonicOffset).toBeCloseTo(2 ** (1 / 12), 5);
    expect(hits[0]!.peakGain).toBeLessThanOrEqual(0.3);
    expect(hits[1]!.delaySec).toBe(CONSOLE_STUTTER_GAP_SEC);
    expect(hits[1]!.peakGain).toBeLessThan(hits[0]!.peakGain!);
  });

  it('red alert loops spaced musical dwoops from the console root', () => {
    expect(RED_ALERT_DURATION_SEC).toBeGreaterThan(0.3);
    expect(RED_ALERT_LOOP_INTERVAL_SEC).toBeGreaterThan(RED_ALERT_DURATION_SEC);
    expect(RED_ALERT_BURST_INTERVAL_SEC).toBe(RED_ALERT_LOOP_INTERVAL_SEC);
  });
});
