/**
 * Admin status strip visibility — localStorage so Options (in BridgeTable)
 * and AdminStatusStrip (in AppShell) stay in sync without shared React state.
 */

const STORAGE_KEY = 'warp12-hide-admin-banner';

type Listener = (hidden: boolean) => void;

const listeners = new Set<Listener>();

function notify(hidden: boolean): void {
  for (const listener of listeners) {
    listener(hidden);
  }
}

export function readHideAdminBanner(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeHideAdminBanner(hidden: boolean): void {
  try {
    if (hidden) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
  notify(hidden);
}

export function subscribeHideAdminBanner(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
