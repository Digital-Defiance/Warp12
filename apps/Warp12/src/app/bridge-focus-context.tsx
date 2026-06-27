import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'warp12-bridge-focus';

interface BridgeFocusContextValue {
  focus: boolean;
  setFocus: (next: boolean) => void;
  toggleFocus: () => void;
}

const BridgeFocusContext = createContext<BridgeFocusContextValue | null>(null);

function readStoredFocus(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeFocus(next: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function BridgeFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState(readStoredFocus);

  const setFocus = useCallback((next: boolean) => {
    setFocusState(next);
    storeFocus(next);
  }, []);

  const toggleFocus = useCallback(() => {
    setFocusState((current) => {
      const next = !current;
      storeFocus(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ focus, setFocus, toggleFocus }),
    [focus, setFocus, toggleFocus]
  );

  useEffect(() => {
    document.documentElement.toggleAttribute('data-bridge-focus', focus);
    return () => document.documentElement.removeAttribute('data-bridge-focus');
  }, [focus]);

  return (
    <BridgeFocusContext.Provider value={value}>
      {children}
    </BridgeFocusContext.Provider>
  );
}

export function useBridgeFocus(): BridgeFocusContextValue {
  const context = useContext(BridgeFocusContext);
  if (!context) {
    throw new Error('useBridgeFocus must be used within BridgeFocusProvider');
  }
  return context;
}
