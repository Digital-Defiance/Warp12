import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAnnounce } from '../a11y/live-announcer.js';
import { copyTextToClipboard } from '../game/deliver-file.js';
import {
  sectorCommentaryUrl,
  sectorHandUrl,
  sectorInviteLinks,
  sectorWatchUrl,
} from '../game/sector-invite-urls.js';
import { COMMENTARY_OVERLAY_PATH } from './commentator-broadcast.js';
import {
  LOCAL_HAND_COMPANION_PATH,
  localHandCompanionPath,
  STREAMER_MANUAL_URL,
} from './hand-companion-broadcast.js';
import dialogStyles from './rules-view.module.scss';
import styles from './stream-setup-dialog.module.scss';

export interface StreamSetupDialogProps {
  open: boolean;
  onClose: () => void;
  /** Online sector code when seated / hosting. */
  sectorCode?: string;
  hideHandOnBridge: boolean;
  onHideHandOnBridgeChange: (next: boolean) => void;
  couchMode?: boolean;
  onCouchModeChange?: (next: boolean) => void;
  onEnableStreamSafe: () => void;
  onEnableCouchMode?: () => void;
  onOpenCommentaryOverlay: () => void;
  onOpenPrivateHand?: () => void;
  onOpenCouchHands?: () => void;
  couchSeats?: readonly { readonly id: string; readonly displayName: string }[];
  isOnline: boolean;
}

export function StreamSetupDialog({
  open,
  onClose,
  sectorCode,
  hideHandOnBridge,
  onHideHandOnBridgeChange,
  couchMode = false,
  onCouchModeChange,
  onEnableStreamSafe,
  onEnableCouchMode,
  onOpenCommentaryOverlay,
  onOpenPrivateHand,
  onOpenCouchHands,
  couchSeats,
  isOnline,
}: StreamSetupDialogProps) {
  const announce = useAnnounce();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const links = useMemo(() => {
    if (!sectorCode) {
      return null;
    }
    return sectorInviteLinks(sectorCode);
  }, [sectorCode]);

  const localCommentaryUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return COMMENTARY_OVERLAY_PATH;
    }
    return `${window.location.origin}${COMMENTARY_OVERLAY_PATH}`;
  }, []);

  const localHandUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return LOCAL_HAND_COMPANION_PATH;
    }
    return `${window.location.origin}${LOCAL_HAND_COMPANION_PATH}`;
  }, []);

  const copy = useCallback(
    async (label: string, url: string) => {
      try {
        await copyTextToClipboard(url);
        const msg = `${label} copied.`;
        setStatus(msg);
        announce(msg, 'polite');
      } catch {
        const msg = `Could not copy ${label.toLowerCase()}.`;
        setStatus(msg);
        announce(msg, 'assertive');
      }
    },
    [announce]
  );

  if (!open) {
    return null;
  }

  const showCouch = !isOnline && (onEnableCouchMode || onOpenCouchHands);

  return (
    <div
      className={dialogStyles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-stream-setup-title"
      onClick={onClose}
    >
      <div
        className={`${dialogStyles.dialogPanel} ${styles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={dialogStyles.dialogHeader}>
          <h2
            id="warp12-stream-setup-title"
            className={dialogStyles.dialogTitle}
          >
            Stream setup
          </h2>
          <button
            type="button"
            className={dialogStyles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Layout for camera</h3>
            <p className={styles.hint}>
              Put the Bridge (table + commentary) on the capture display. Keep
              private hands on second monitors or phones — never in the OBS
              crop.
            </p>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={hideHandOnBridge}
                onChange={(event) =>
                  onHideHandOnBridgeChange(event.target.checked)
                }
              />
              <span>Hide hand on this Bridge (stream-safe)</span>
            </label>
            {onCouchModeChange ? (
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={couchMode}
                  onChange={(event) =>
                    onCouchModeChange(event.target.checked)
                  }
                />
                <span>
                  Couch mode (per-seat hands; skip pass-the-device handoff)
                </span>
              </label>
            ) : null}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  onEnableStreamSafe();
                  const msg =
                    'Stream-safe on — hand hidden, commentator log armed.';
                  setStatus(msg);
                  announce(msg, 'polite');
                }}
              >
                Enable stream-safe
              </button>
              {onEnableCouchMode ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => {
                    onEnableCouchMode();
                    const msg =
                      'Couch mode on — seat hands opened, handoff skipped.';
                    setStatus(msg);
                    announce(msg, 'polite');
                  }}
                >
                  Enable couch mode
                </button>
              ) : null}
              {onOpenPrivateHand ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={onOpenPrivateHand}
                >
                  Open private hand
                </button>
              ) : null}
              {onOpenCouchHands ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={onOpenCouchHands}
                >
                  Open seat hands
                </button>
              ) : null}
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onOpenCommentaryOverlay}
              >
                Open commentary overlay
              </button>
            </div>
          </section>

          {showCouch && couchSeats && couchSeats.length > 0 ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Couch seat URLs</h3>
              <p className={styles.hint}>
                Each captain opens their locked seat on their own device. Keep
                the Bridge tab open on the table display.
              </p>
              <ul className={styles.linkList}>
                {couchSeats.map((seat) => {
                  const path = localHandCompanionPath(seat.id);
                  const url =
                    typeof window === 'undefined'
                      ? path
                      : `${window.location.origin}${path}`;
                  return (
                    <li key={seat.id}>
                      <span className={styles.linkLabel}>{seat.displayName}</span>
                      <code className={styles.url}>{url}</code>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={() =>
                          void copy(`${seat.displayName} hand URL`, url)
                        }
                      >
                        Copy
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>OBS browser sources</h3>
            {isOnline && links ? (
              <ul className={styles.linkList}>
                <li>
                  <span className={styles.linkLabel}>Watch</span>
                  <code className={styles.url}>{links.watchUrl}</code>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => void copy('Watch URL', links.watchUrl)}
                  >
                    Copy
                  </button>
                </li>
                <li>
                  <span className={styles.linkLabel}>Commentary</span>
                  <code className={styles.url}>{links.commentaryUrl}</code>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() =>
                      void copy('Commentary URL', links.commentaryUrl)
                    }
                  >
                    Copy
                  </button>
                </li>
                <li>
                  <span className={styles.linkLabel}>Private hand</span>
                  <code className={styles.url}>{links.handUrl}</code>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => void copy('Private hand URL', links.handUrl)}
                  >
                    Copy
                  </button>
                </li>
                <li>
                  <span className={styles.linkLabel}>Join</span>
                  <code className={styles.url}>{links.joinUrl}</code>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => void copy('Join URL', links.joinUrl)}
                  >
                    Copy
                  </button>
                </li>
              </ul>
            ) : (
              <ul className={styles.linkList}>
                <li>
                  <span className={styles.linkLabel}>Commentary</span>
                  <code className={styles.url}>{localCommentaryUrl}</code>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() =>
                      void copy('Commentary URL', localCommentaryUrl)
                    }
                  >
                    Copy
                  </button>
                </li>
                <li>
                  <span className={styles.linkLabel}>Private hand</span>
                  <code className={styles.url}>{localHandUrl}</code>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() =>
                      void copy('Private hand URL', localHandUrl)
                    }
                  >
                    Copy
                  </button>
                </li>
              </ul>
            )}
            <p className={styles.hint}>
              {isOnline
                ? 'Watch / commentary need the host’s spectator gallery open. Private hand requires your Firebase seat (anonymous or Google) — open it off-camera.'
                : 'Local commentary and private hand mirror the live Bridge via BroadcastChannel — keep the game tab open. Never add the private hand URL as an OBS source.'}
            </p>
          </section>

          {status ? (
            <p className={styles.status} role="status">
              {status}
            </p>
          ) : null}

          <p className={styles.hint}>
            Full walkthrough:{' '}
            <a
              href={STREAMER_MANUAL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Streamer Manual
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

/** Helpers re-exported for tests / callers that only need URLs. */
export {
  sectorCommentaryUrl,
  sectorHandUrl,
  sectorWatchUrl,
};
