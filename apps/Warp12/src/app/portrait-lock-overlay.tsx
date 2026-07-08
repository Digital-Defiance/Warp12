import { useEffect } from 'react';

import {
  tryLockPortraitOrientation,
  unlockPortraitOrientation,
} from './portrait-lock';
import styles from './portrait-lock-overlay.module.scss';

export interface PortraitLockOverlayProps {
  active: boolean;
  title?: string;
  body?: string;
}

export function PortraitLockOverlay({
  active,
  title = 'Rotate to portrait',
  body = 'Turn your device upright to continue.',
}: PortraitLockOverlayProps) {
  useEffect(() => {
    if (!active) {
      unlockPortraitOrientation();
      return;
    }
    void tryLockPortraitOrientation();
    return () => {
      unlockPortraitOrientation();
    };
  }, [active]);

  if (!active) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="portrait-lock-title"
      aria-describedby="portrait-lock-body"
    >
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden>
          📱
        </span>
        <h2 id="portrait-lock-title" className={styles.title}>
          {title}
        </h2>
        <p id="portrait-lock-body" className={styles.body}>
          {body}
        </p>
      </div>
    </div>
  );
}
