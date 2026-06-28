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
  tableSessionActive: boolean;
  registerTableSession: () => void;
  unregisterTableSession: () => void;
}

const BridgeFocusContext = createContext<BridgeFocusContextValue | null>(null);

function readStoredFocus(): boolean {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return true;
    }
    return stored === 'true';
  } catch {
    return true;
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
  const [tableSessionCount, setTableSessionCount] = useState(0);

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

  const registerTableSession = useCallback(() => {
    setTableSessionCount((count) => count + 1);
  }, []);

  const unregisterTableSession = useCallback(() => {
    setTableSessionCount((count) => Math.max(0, count - 1));
  }, []);

  const tableSessionActive = tableSessionCount > 0;
  const layoutFocus = focus && tableSessionActive;

  const value = useMemo(
    () => ({
      focus,
      setFocus,
      toggleFocus,
      tableSessionActive,
      registerTableSession,
      unregisterTableSession,
    }),
    [
      focus,
      setFocus,
      toggleFocus,
      tableSessionActive,
      registerTableSession,
      unregisterTableSession,
    ]
  );

  useEffect(() => {
    document.documentElement.toggleAttribute('data-bridge-focus', layoutFocus);
    return () => document.documentElement.removeAttribute('data-bridge-focus');
  }, [layoutFocus]);

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

/** Marks the current view as an active table session (locks viewport for pan/zoom). */
export function useTableSession(): void {
  const { registerTableSession, unregisterTableSession } = useBridgeFocus();

  useEffect(() => {
    registerTableSession();
    return unregisterTableSession;
  }, [registerTableSession, unregisterTableSession]);
}
