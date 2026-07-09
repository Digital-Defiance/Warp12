import { describe, expect, it } from 'vitest';

import {
  ALL_STOP_DURATION_SEC,
  createNoiseBuffer,
  CONTINUUM_FLASH_DURATION_SEC,
  scheduleAllStop,
  scheduleContinuumFlash,
  scheduleWarpDrop,
  scheduleWarpEngage,
  WARP_DROP_DURATION_SEC,
  WARP_ENGAGE_DURATION_SEC,
  WARP_NOISE_BUFFER_SEC,
} from './musical-warp-synth.js';

describe('musical warp synth', () => {
  it('exports expected timing constants', () => {
    expect(WARP_NOISE_BUFFER_SEC).toBe(3);
    expect(WARP_ENGAGE_DURATION_SEC).toBe(2);
    expect(WARP_DROP_DURATION_SEC).toBe(4);
    expect(CONTINUUM_FLASH_DURATION_SEC).toBe(0.5);
    expect(ALL_STOP_DURATION_SEC).toBe(5);
  });

  it('builds a mono white-noise buffer', () => {
    const ctx = {
      sampleRate: 48000,
      createBuffer: (
        channels: number,
        length: number,
        sampleRate: number
      ) => ({
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: () => new Float32Array(length),
      }),
    } as unknown as AudioContext;

    const buffer = createNoiseBuffer(ctx, 1.5);
    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.length).toBe(72000);
  });

  it('schedules engage and drop without throwing', () => {
    const nodes: AudioScheduledSourceNode[] = [];
    const ctx = {
      currentTime: 0,
      sampleRate: 48000,
      destination: {},
      createOscillator: () => {
        const osc = {
          type: 'sine' as OscillatorType,
          frequency: {
            setValueAtTime: () => undefined,
            exponentialRampToValueAtTime: () => undefined,
            linearRampToValueAtTime: () => undefined,
          },
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
        };
        nodes.push(osc as unknown as AudioScheduledSourceNode);
        return osc;
      },
      createGain: () => ({
        gain: {
          value: 1,
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: () => undefined,
      }),
      createBuffer: () => ({
        getChannelData: () => new Float32Array(100),
      }),
      createBufferSource: () => {
        const source = {
          buffer: null as AudioBuffer | null,
          loop: false,
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
        };
        nodes.push(source as unknown as AudioScheduledSourceNode);
        return source;
      },
      createBiquadFilter: () => ({
        type: 'lowpass' as BiquadFilterType,
        frequency: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        connect: () => undefined,
      }),
    } as unknown as AudioContext;

    const dest = { connect: () => undefined } as unknown as AudioNode;
    const engage = scheduleWarpEngage(ctx, dest, 0);
    const drop = scheduleWarpDrop(ctx, dest, 0);
    const flash = scheduleContinuumFlash(ctx, dest, 0);
    const allStop = scheduleAllStop(ctx, dest, 0);

    expect(engage.nodes.length).toBe(2);
    expect(drop.nodes.length).toBe(3);
    expect(flash.nodes.length).toBe(2);
    expect(allStop.nodes.length).toBe(3);
    engage.stop();
    drop.stop();
    flash.stop();
    allStop.stop();
  });
});
