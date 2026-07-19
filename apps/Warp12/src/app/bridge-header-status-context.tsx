import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Connection health for the header indicator:
 * - `live`: listeners attached and showing server-confirmed data (green).
 * - `stale`: listeners attached but showing local-cache data the server has not
 *   yet confirmed — this client is out of sync (orange).
 * - `pending`: reconnecting or transmitting a move (amber).
 */
export type BridgeConnectionState = 'live' | 'stale' | 'pending';

/** TEI eligibility badge in the header center. */
export type BridgeRatingState = 'rated' | 'unrated' | 'exhibition';

export interface BridgeHeaderStatus {
  sectorLabel?: string;
  connectionLabel?: string;
  connectionState?: BridgeConnectionState;
  /** Colorized Rated / Unrated / Exhibition in the header center. */
  ratingLabel?: string;
  ratingState?: BridgeRatingState;
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
    current.connectionState === next.connectionState &&
    current.ratingLabel === next.ratingLabel &&
    current.ratingState === next.ratingState
  );
}

export function BridgeHeaderStatusProvider({ children }: { children: ReactNode }) {
  const [headerStatus, setHeaderStatusState] = useState<BridgeHeaderStatus | null>(
    null
  );

  const setHeaderStatus = useCallback((next: BridgeHeaderStatus | null) => {
    setHeaderStatusState((current) => {
      if (next === null) {
        return null;
      }
      // Merge so connection (online page) and rating (BridgeTable) can update
      // independently without wiping each other.
      const merged: BridgeHeaderStatus = { ...(current ?? {}), ...next };
      return statusEqual(current, merged) ? current : merged;
    });
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
