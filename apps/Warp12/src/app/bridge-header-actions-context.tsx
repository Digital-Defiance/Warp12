import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface BridgeHeaderAction {
  id: string;
  label: string;
  onClick: () => void;
}

interface BridgeHeaderActionMeta {
  id: string;
  label: string;
}

interface BridgeHeaderActionsRegistration {
  registerActions: (actions: BridgeHeaderAction[]) => void;
  clearActions: () => void;
}

interface BridgeHeaderActionsDisplay {
  actions: BridgeHeaderActionMeta[];
  invokeAction: (id: string) => void;
}

const BridgeHeaderActionsRegistrationContext =
  createContext<BridgeHeaderActionsRegistration | null>(null);

const BridgeHeaderActionsDisplayContext =
  createContext<BridgeHeaderActionsDisplay | null>(null);

function metasEqual(
  current: BridgeHeaderActionMeta[],
  next: BridgeHeaderActionMeta[]
): boolean {
  if (current.length !== next.length) {
    return false;
  }
  return current.every(
    (action, index) =>
      action.id === next[index].id && action.label === next[index].label
  );
}

export function BridgeHeaderActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [actionMetas, setActionMetas] = useState<BridgeHeaderActionMeta[]>([]);
  const handlersRef = useRef<Map<string, () => void>>(new Map());

  const registerActions = useCallback((next: BridgeHeaderAction[]) => {
    handlersRef.current = new Map(next.map((action) => [action.id, action.onClick]));
    const metas = next.map(({ id, label }) => ({ id, label }));
    setActionMetas((current) => (metasEqual(current, metas) ? current : metas));
  }, []);

  const clearActions = useCallback(() => {
    handlersRef.current = new Map();
    setActionMetas((current) => (current.length === 0 ? current : []));
  }, []);

  const invokeAction = useCallback((id: string) => {
    handlersRef.current.get(id)?.();
  }, []);

  const registration = useMemo(
    () => ({ registerActions, clearActions }),
    [registerActions, clearActions]
  );

  const display = useMemo(
    () => ({ actions: actionMetas, invokeAction }),
    [actionMetas, invokeAction]
  );

  return (
    <BridgeHeaderActionsRegistrationContext.Provider value={registration}>
      <BridgeHeaderActionsDisplayContext.Provider value={display}>
        {children}
      </BridgeHeaderActionsDisplayContext.Provider>
    </BridgeHeaderActionsRegistrationContext.Provider>
  );
}

/** Header chrome — re-renders when visible action buttons change. */
export function useBridgeHeaderActions(): BridgeHeaderActionsDisplay {
  const context = useContext(BridgeHeaderActionsDisplayContext);
  if (!context) {
    throw new Error(
      'useBridgeHeaderActions must be used within BridgeHeaderActionsProvider'
    );
  }
  return context;
}

/** Game table — stable; does not re-render when header actions update. */
export function useBridgeHeaderActionRegistration(): BridgeHeaderActionsRegistration {
  const context = useContext(BridgeHeaderActionsRegistrationContext);
  if (!context) {
    throw new Error(
      'useBridgeHeaderActionRegistration must be used within BridgeHeaderActionsProvider'
    );
  }
  return context;
}
