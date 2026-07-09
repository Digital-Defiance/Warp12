import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isBridgeAmbienceEnabled,
  isGameAudioBackgroundSuspended,
  resetGameAudioStateForTests,
  setBridgeAmbienceEnabled,
  setGameAudioBackgroundSuspended,
  setGameSoundsMuted,
  unlockGameAudio,
} from './game-sounds.js';

function mockAudioContext(): void {
  const start = vi.fn();
  const stop = vi.fn();
  class MockGain {
    gain = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    connect = vi.fn();
    disconnect = vi.fn();
  }
  class MockOscillator {
    type = 'sine';
    frequency = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    connect = vi.fn();
    start = start;
    stop = stop;
  }
  class MockFilter {
    type = 'lowpass';
    frequency = { value: 0 };
    connect = vi.fn();
  }
  class MockBufferSource {
    loop = false;
    buffer = null;
    connect = vi.fn();
    start = start;
    stop = stop;
  }
  vi.stubGlobal(
    'AudioContext',
    class MockAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createGain = () => new MockGain();
      createOscillator = () => new MockOscillator();
      createBiquadFilter = () => new MockFilter();
      createBuffer = () => ({ getChannelData: () => new Float32Array(8) });
      createBufferSource = () => new MockBufferSource();
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    }
  );
}

describe('bridge ambience', () => {
  beforeEach(() => {
    resetGameAudioStateForTests();
    vi.restoreAllMocks();
    mockAudioContext();
  });

  it('tracks whether bridge ambience is requested', () => {
    expect(isBridgeAmbienceEnabled()).toBe(false);
    setBridgeAmbienceEnabled(true);
    expect(isBridgeAmbienceEnabled()).toBe(true);
    setBridgeAmbienceEnabled(false);
    expect(isBridgeAmbienceEnabled()).toBe(false);
  });

  it('starts procedural ambience after audio unlock when enabled', () => {
    const oscStart = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {
        state = 'running';
        currentTime = 0;
        destination = {};
        createGain = () => ({
          gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        });
        createOscillator = () => ({
          type: 'sine',
          frequency: { value: 0, setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: oscStart,
          stop: vi.fn(),
        });
        createBiquadFilter = () => ({ type: 'lowpass', frequency: { value: 0 }, connect: vi.fn() });
        createBuffer = () => ({ getChannelData: () => new Float32Array(8) });
        createBufferSource = () => ({
          loop: false,
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        });
        resume = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
      }
    );

    setBridgeAmbienceEnabled(true);
    expect(oscStart).not.toHaveBeenCalled();

    unlockGameAudio();
    expect(oscStart).toHaveBeenCalled();
  });

  it('does not start when table sounds are muted', () => {
    const start = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {
        state = 'running';
        currentTime = 0;
        destination = {};
        createGain = () => ({
          gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
        });
        createOscillator = () => ({
          type: 'sine',
          frequency: { value: 0, setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start,
          stop: vi.fn(),
        });
        createBiquadFilter = () => ({ type: 'lowpass', frequency: { value: 0 }, connect: vi.fn() });
        createBuffer = () => ({ getChannelData: () => new Float32Array(8) });
        createBufferSource = () => ({
          loop: false,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        });
        resume = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
      }
    );

    setGameSoundsMuted(true);
    setBridgeAmbienceEnabled(true);
    unlockGameAudio();
    expect(start).not.toHaveBeenCalled();
  });

  it('pauses bridge ambience while the app is backgrounded', () => {
    const stop = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {
        state = 'running';
        currentTime = 0;
        destination = {};
        createGain = () => ({
          gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
        });
        createOscillator = () => ({
          type: 'sine',
          frequency: { value: 0, setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop,
        });
        createBiquadFilter = () => ({ type: 'lowpass', frequency: { value: 0 }, connect: vi.fn() });
        createBuffer = () => ({ getChannelData: () => new Float32Array(8) });
        createBufferSource = () => ({
          loop: false,
          connect: vi.fn(),
          start: vi.fn(),
          stop,
        });
        resume = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
      }
    );

    setBridgeAmbienceEnabled(true);
    unlockGameAudio();

    setGameAudioBackgroundSuspended(true);
    expect(isGameAudioBackgroundSuspended()).toBe(true);
    expect(stop).toHaveBeenCalled();

    setGameAudioBackgroundSuspended(false);
  });
});
