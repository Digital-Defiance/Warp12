import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface BridgeHeaderStatus {
  sectorLabel?: string;
  connectionLabel: string;
  connectionLive?: boolean;
}

interface BridgeHeaderStatusRegistration {
  setHeaderStatus: (status: BridgeHeaderStatus | null) => void;
}

interface BridgeHeaderStatusDisplay {
  headerStatus: BridgeHeaderStatus | null;
}

const BridgeHeaderStatusRegistrationContext =
  createContext<BridgeHeaderStatusRegistration | null>(null);

const BridgeHeaderStatusDisplayContext =
  createContext<BridgeHeaderStatusDisplay | null>(null);

function statusEqual(
  current: BridgeHeaderStatus | null,
  next: BridgeHeaderStatus | null
): boolean {
  if (current === next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }
  return (
    current.sectorLabel === next.sectorLabel &&
    current.connectionLabel === next.connectionLabel &&
    current.connectionLive === next.connectionLive
  );
}

export function BridgeHeaderStatusProvider({ children }: { children: ReactNode }) {
  const [headerStatus, setHeaderStatusState] = useState<BridgeHeaderStatus | null>(
    null
  );

  const setHeaderStatus = useCallback((next: BridgeHeaderStatus | null) => {
    setHeaderStatusState((current) =>
      statusEqual(current, next) ? current : next
    );
  }, []);

  const registration = useMemo(() => ({ setHeaderStatus }), [setHeaderStatus]);
  const display = useMemo(() => ({ headerStatus }), [headerStatus]);

  return (
    <BridgeHeaderStatusRegistrationContext.Provider value={registration}>
      <BridgeHeaderStatusDisplayContext.Provider value={display}>
        {children}
      </BridgeHeaderStatusDisplayContext.Provider>
    </BridgeHeaderStatusRegistrationContext.Provider>
  );
}

export function useBridgeHeaderStatus(): BridgeHeaderStatusDisplay {
  const context = useContext(BridgeHeaderStatusDisplayContext);
  if (!context) {
    throw new Error(
      'useBridgeHeaderStatus must be used within BridgeHeaderStatusProvider'
    );
  }
  return context;
}

export function useBridgeHeaderStatusRegistration(): BridgeHeaderStatusRegistration {
  const context = useContext(BridgeHeaderStatusRegistrationContext);
  if (!context) {
    throw new Error(
      'useBridgeHeaderStatusRegistration must be used within BridgeHeaderStatusProvider'
    );
  }
  return context;
}
