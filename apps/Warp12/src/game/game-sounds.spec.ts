import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isBridgeAmbienceEnabled,
  setBridgeAmbienceEnabled,
  setGameSoundsMuted,
  unlockGameAudio,
} from './game-sounds.js';

describe('bridge ambience', () => {
  beforeEach(() => {
    setGameSoundsMuted(false);
    setBridgeAmbienceEnabled(false);
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
});
