import { useEffect, useState } from 'react';

import {
  COMMENTARY_OVERLAY_PATH,
  COMMENTATOR_CHANNEL,
  isCommentatorBroadcastMessage,
  requestCommentatorSnapshot,
  type CommentatorSnapshotMessage,
} from './commentator-broadcast.js';
import {
  COMMENTATOR_OVERLAY_MAX_LINES,
  takeRecentLogLines,
} from './game-log-filter.js';
import { GameLogLine } from './game-log-line.js';
import {
  LOG_FONT_SCALE_FACTOR,
  readTableOptions,
} from './table-view-prefs.js';
import styles from './commentary-overlay-page.module.scss';

/**
 * OBS / pop-out browser source. Listens for BroadcastChannel snapshots from a
 * live Bridge window (local or online). Keep the game tab open while streaming.
 */
export function CommentaryOverlayPage() {
  const [snapshot, setSnapshot] = useState<CommentatorSnapshotMessage | null>(
    null
  );
  const [waiting, setWaiting] = useState(true);
  const [fontScale, setFontScale] = useState(
    () => LOG_FONT_SCALE_FACTOR[readTableOptions().logFontScale]
  );

  useEffect(() => {
    document.documentElement.dataset.commentaryOverlay = 'true';
    document.body.dataset.commentaryOverlay = 'true';
    return () => {
      delete document.documentElement.dataset.commentaryOverlay;
      delete document.body.dataset.commentaryOverlay;
    };
  }, []);

  useEffect(() => {
    const syncFont = () => {
      setFontScale(LOG_FONT_SCALE_FACTOR[readTableOptions().logFontScale]);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'warp12-table-options' || event.key === null) {
        syncFont();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncFont);
    const timer = window.setInterval(syncFont, 2000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncFont);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      setWaiting(false);
      return;
    }
    const channel = new BroadcastChannel(COMMENTATOR_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      if (!isCommentatorBroadcastMessage(event.data)) {
        return;
      }
      if (event.data.type === 'snapshot') {
        setSnapshot(event.data);
        setWaiting(false);
      }
    };
    requestCommentatorSnapshot();
    return () => {
      channel.close();
    };
  }, []);

  const lines = takeRecentLogLines(
    snapshot?.lines ?? [],
    COMMENTATOR_OVERLAY_MAX_LINES
  );

  return (
    <main
      className={styles.overlay}
      aria-live="polite"
      aria-relevant="additions"
      style={{ ['--log-font-scale' as string]: String(fontScale) }}
    >
      <h1 className={styles.srOnly}>Warp commentary overlay</h1>
      {waiting && lines.length === 0 ? (
        <p className={styles.waiting} role="status">
          Waiting for a live Bridge… Keep your game tab open, then set Comms log
          to Commentator. OBS browser source URL: {COMMENTARY_OVERLAY_PATH}
        </p>
      ) : null}
      {snapshot?.title ? (
        <p className={styles.title} aria-hidden={lines.length > 0}>
          {snapshot.title}
          {snapshot.sectorCode ? ` · ${snapshot.sectorCode}` : ''}
        </p>
      ) : null}
      <div className={styles.feed}>
        {lines.map((line, index) => (
          <GameLogLine
            key={`${index}-${line}`}
            line={line}
            nameColors={snapshot?.nameColors ?? []}
            className={`${styles.line}${
              index === lines.length - 1 ? ` ${styles.lineLatest}` : ''
            }`}
          />
        ))}
      </div>
    </main>
  );
}
