import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  isPhoneLandscape,
  resolveLayoutOrientation,
  resolveLayoutTier,
  type LayoutOrientation,
  type LayoutTier,
} from './layout-tier.js';

export interface LayoutTierState {
  tier: LayoutTier;
  orientation: LayoutOrientation;
  phoneLandscape: boolean;
}

const LayoutTierContext = createContext<LayoutTierState | null>(null);

function readLayoutState(): LayoutTierState {
  if (typeof window === 'undefined') {
    return { tier: 'desktop', orientation: 'landscape', phoneLandscape: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const tier = resolveLayoutTier(width, height);
  const orientation = resolveLayoutOrientation(width, height);
  return {
    tier,
    orientation,
    phoneLandscape: isPhoneLandscape(tier, width, height),
  };
}

export function LayoutTierProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutTierState>(readLayoutState);

  useEffect(() => {
    const update = () => {
      setState(readLayoutState());
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <LayoutTierContext.Provider value={value}>
      {children}
    </LayoutTierContext.Provider>
  );
}

export function useLayoutTierState(): LayoutTierState {
  const context = useContext(LayoutTierContext);
  if (!context) {
    throw new Error('useLayoutTierState must be used within LayoutTierProvider');
  }
  return context;
}

export function useLayoutTier(): LayoutTier {
  return useLayoutTierState().tier;
}
