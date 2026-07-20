import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isWarpFactor,
  normalizeWarpFactor,
  WARP_FACTORS,
  type WarpFactor,
} from 'warp12-engine';

export { isWarpFactor, normalizeWarpFactor, WARP_FACTORS, type WarpFactor };

/** Fired on `window` whenever the stored warp factor is written or cleared. */
export const WARP_FACTOR_CHANGE_EVENT = 'warp12-factor-change';

function notifyWarpFactorChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WARP_FACTOR_CHANGE_EVENT));
}

export function useQueryWarpFactor(): WarpFactor | undefined {
  const query = useLocation().search;
  const queryWarpFactor = query.split('factor=')[1];
  if (queryWarpFactor === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(queryWarpFactor, 10);
  return isWarpFactor(parsed) ? parsed : undefined;
}

export function getWarpFactor(): WarpFactor | undefined {
  const raw = localStorage.getItem('warp-factor');
  if (raw === null || raw === '') {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return isWarpFactor(parsed) ? parsed : undefined;
}

/** Active factor for play — defaults to 12 when unset. */
export function requireWarpFactor(): WarpFactor {
  return normalizeWarpFactor(getWarpFactor() ?? 12);
}

/** Reactive stored factor (undefined until the captain has chosen). */
export function useStoredWarpFactor(): WarpFactor | undefined {
  const [factor, setFactor] = useState<WarpFactor | undefined>(() =>
    getWarpFactor()
  );

  useEffect(() => {
    const sync = () => setFactor(getWarpFactor());
    window.addEventListener(WARP_FACTOR_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WARP_FACTOR_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return factor;
}

/** Reactive play factor — defaults to 12 when unset. */
export function useRequireWarpFactor(): WarpFactor {
  return normalizeWarpFactor(useStoredWarpFactor() ?? 12);
}

/** Remove the saved factor (chooser / recording reset). */
export function clearWarpFactor(): void {
  localStorage.removeItem('warp-factor');
  notifyWarpFactorChange();
}

export function setWarpFactor(factor: number): void {
  if (isWarpFactor(factor)) {
    localStorage.setItem('warp-factor', factor.toString());
    notifyWarpFactorChange();
  } else {
    clearWarpFactor();
  }
}
