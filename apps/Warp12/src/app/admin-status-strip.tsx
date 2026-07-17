import { useEffect, useState } from 'react';

import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { userHasAdminRole } from '../firebase/warp-auth-roles.js';
import { subscribeAdminToolsLoaded } from '../game/local-game-dev-console.js';

import {
  readHideAdminBanner,
  subscribeHideAdminBanner,
} from './admin-banner-prefs.js';
import styles from './admin-status-strip.module.scss';

/** Fixed top strip — only renders for Firebase admin sessions. */
export function AdminStatusStrip() {
  const auth = useFirebaseAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [toolsLoaded, setToolsLoaded] = useState(false);
  const [hidden, setHidden] = useState(() => readHideAdminBanner());

  useEffect(() => {
    let cancelled = false;
    void userHasAdminRole(auth.user).then((ok) => {
      if (!cancelled) {
        setIsAdmin(ok);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  useEffect(() => subscribeAdminToolsLoaded(setToolsLoaded), []);
  useEffect(() => subscribeHideAdminBanner(setHidden), []);

  if (!isAdmin || hidden) {
    return null;
  }

  return (
    <div
      className={styles.strip}
      data-tools={toolsLoaded ? 'loaded' : 'idle'}
      role="status"
      aria-label={
        toolsLoaded ? 'Admin session, bridge console tools loaded' : 'Admin session'
      }
    >
      <span className={styles.label}>
        {toolsLoaded ? 'ADMIN · TOOLS' : 'ADMIN'}
      </span>
    </div>
  );
}
