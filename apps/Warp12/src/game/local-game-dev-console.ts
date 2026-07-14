type AdminToolsListener = (toolsLoaded: boolean) => void;

const adminToolsListeners = new Set<AdminToolsListener>();

/** BridgeTable publishes unlock/lock so the fixed ADMIN strip can update. */
export function publishAdminToolsLoaded(toolsLoaded: boolean): void {
  for (const listener of adminToolsListeners) {
    listener(toolsLoaded);
  }
}

export function subscribeAdminToolsLoaded(
  listener: AdminToolsListener
): () => void {
  adminToolsListeners.add(listener);
  return () => {
    adminToolsListeners.delete(listener);
  };
}

/**
 * Dev-bridge console unlock (DESCENT-style).
 *
 * In DEV local simulation only:
 * 1. Call {@link DEV_CONSOLE_UNLOCK_COMMAND} — refuses unless Firebase Auth
 *    custom claim `roles` includes `admin` (fresh ID token).
 * 2. Unlock installs `window.localGame` and logs CHEATER on the sector ticker.
 * 3. TEI still grades for admins (server re-checks claims); non-admins never
 *    get the tools installed. Clients must not be trusted alone for that.
 */

export const DEV_CONSOLE_UNLOCK_COMMAND = 'GABBAGABBAHEY' as const;

/**
 * Whether unlock voids TEI from the client's optimistic view.
 * Admins keep TEI; server confirms claim on report.
 */
export function consoleUnlockVoidsTei(options: {
  readonly isAdmin: boolean;
}): boolean {
  return !options.isAdmin;
}

/** Combine advisor + console flags for client-side TEI eligibility preview. */
export function assistanceVoidsPracticeTei(options: {
  readonly advisorUsed: boolean;
  readonly devToolsUsed: boolean;
  readonly isAdmin: boolean;
}): boolean {
  if (options.advisorUsed) {
    return true;
  }
  if (options.devToolsUsed && !options.isAdmin) {
    return true;
  }
  return false;
}
