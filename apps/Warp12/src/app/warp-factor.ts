import { useLocation } from 'react-router-dom';
import {
  isWarpFactor,
  normalizeWarpFactor,
  WARP_FACTORS,
  type WarpFactor,
} from 'warp12-engine';

export { isWarpFactor, normalizeWarpFactor, WARP_FACTORS, type WarpFactor };

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

export function setWarpFactor(factor: number): void {
  if (isWarpFactor(factor)) {
    localStorage.setItem('warp-factor', factor.toString());
  } else {
    localStorage.removeItem('warp-factor');
  }
}
