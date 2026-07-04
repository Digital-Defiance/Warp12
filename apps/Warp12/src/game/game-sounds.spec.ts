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

describe('bridge ambience', () => {
  beforeEach(() => {
    resetGameAudioStateForTests();
    vi.restoreAllMocks();
  });

  it('tracks whether bridge ambience is requested', () => {
    expect(isBridgeAmbienceEnabled()).toBe(false);
    setBridgeAmbienceEnabled(true);
    expect(isBridgeAmbienceEnabled()).toBe(true);
    setBridgeAmbienceEnabled(false);
    expect(isBridgeAmbienceEnabled()).toBe(false);
  });

  it('starts looping playback after audio unlock when enabled', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class MockAudio {
        loop = false;
        preload = '';
        volume = 1;
        paused = true;
        currentTime = 0;
        load = vi.fn();
        play = play;
        pause = vi.fn();
      }
    );

    setBridgeAmbienceEnabled(true);
    expect(play).not.toHaveBeenCalled();

    unlockGameAudio();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not start when table sounds are muted', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class MockAudio {
        loop = false;
        preload = '';
        volume = 1;
        paused = true;
        currentTime = 0;
        load = vi.fn();
        play = play;
        pause = vi.fn();
      }
    );

    setGameSoundsMuted(true);
    setBridgeAmbienceEnabled(true);
    unlockGameAudio();
    expect(play).not.toHaveBeenCalled();
  });

  it('pauses bridge ambience while the app is backgrounded', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    vi.stubGlobal(
      'Audio',
      class MockAudio {
        loop = false;
        preload = '';
        volume = 1;
        paused = true;
        currentTime = 0;
        load = vi.fn();
        play = play;
        pause = pause;
      }
    );

    setBridgeAmbienceEnabled(true);
    unlockGameAudio();
    expect(play).toHaveBeenCalledTimes(1);

    setGameAudioBackgroundSuspended(true);
    expect(isGameAudioBackgroundSuspended()).toBe(true);
    expect(pause).toHaveBeenCalled();

    setGameAudioBackgroundSuspended(false);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
