import { useEffect } from 'react';

import { setBridgeAmbienceEnabled } from './game-sounds.js';

/** Loop bridge ambience while an active sector is on screen. */
export function useBridgeAmbience(options: {
  active: boolean;
  bridgeSoundsEnabled: boolean;
  soundsMuted: boolean;
}): void {
  useEffect(() => {
    const shouldPlay =
      options.active && options.bridgeSoundsEnabled && !options.soundsMuted;
    setBridgeAmbienceEnabled(shouldPlay);
    return () => setBridgeAmbienceEnabled(false);
  }, [options.active, options.bridgeSoundsEnabled, options.soundsMuted]);
}
