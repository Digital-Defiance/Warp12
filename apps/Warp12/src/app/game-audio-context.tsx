import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  installGameSoundDevTools,
  readStoredGameSoundsMuted,
  setGameAudioBackgroundSuspended,
  setGameSoundsMuted,
  storeGameSoundsMuted,
  unlockGameAudio,
} from '../game/game-sounds.js';

interface GameAudioContextValue {
  muted: boolean;
  setMuted: (next: boolean) => void;
  toggleMuted: () => void;
}

const GameAudioContext = createContext<GameAudioContextValue | null>(null);

export function GameAudioProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(() => {
    const stored = readStoredGameSoundsMuted();
    setGameSoundsMuted(stored);
    return stored;
  });

  useEffect(() => {
    installGameSoundDevTools();
  }, []);

  useEffect(() => {
    const unlock = () => {
      unlockGameAudio();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const syncBackgroundAudio = () => {
      setGameAudioBackgroundSuspended(document.visibilityState === 'hidden');
    };
    syncBackgroundAudio();
    document.addEventListener('visibilitychange', syncBackgroundAudio);
    window.addEventListener('pagehide', syncBackgroundAudio);
    window.addEventListener('pageshow', syncBackgroundAudio);
    return () => {
      document.removeEventListener('visibilitychange', syncBackgroundAudio);
      window.removeEventListener('pagehide', syncBackgroundAudio);
      window.removeEventListener('pageshow', syncBackgroundAudio);
    };
  }, []);

  const setMuted = useCallback((next: boolean) => {
    storeGameSoundsMuted(next);
    setGameSoundsMuted(next);
    setMutedState(next);
    if (!next) {
      unlockGameAudio();
    }
  }, []);

  const toggleMuted = useCallback(() => {
    setMutedState((current) => {
      const next = !current;
      storeGameSoundsMuted(next);
      setGameSoundsMuted(next);
      if (!next) {
        unlockGameAudio();
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ muted, setMuted, toggleMuted }),
    [muted, setMuted, toggleMuted]
  );

  return (
    <GameAudioContext.Provider value={value}>
      {children}
    </GameAudioContext.Provider>
  );
}

export function useGameAudio(): GameAudioContextValue {
  const context = useContext(GameAudioContext);
  if (!context) {
    throw new Error('useGameAudio must be used within GameAudioProvider');
  }
  return context;
}
