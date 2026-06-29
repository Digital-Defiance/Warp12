import type { ReactNode } from 'react';

import type { ShareRoundDelivery, ShareRoundImageMode } from '../game/share-round.js';
import {
  LayerGroupIcon,
  RoundLogIcon,
  SaveImageIcon,
  ShareImageIcon,
} from './round-image-icons';
import styles from './round-image-actions.module.scss';

interface RoundImageActionsProps {
  systemShareAvailable: boolean;
  roundImageBusy: string | null;
  roundLogBusy?: boolean;
  onRoundImage: (
    mode: ShareRoundImageMode,
    delivery: ShareRoundDelivery
  ) => void | Promise<void>;
  onSaveRoundLog?: () => void;
  className?: string;
}

function busyKey(delivery: ShareRoundDelivery, mode: ShareRoundImageMode): string {
  return `${delivery}-${mode}`;
}

function SplitIconGroup({
  groupLabel,
  primaryLabel,
  overlayLabel,
  primaryIcon,
  overlayIcon,
  delivery,
  roundImageBusy,
  disabled,
  onRoundImage,
}: {
  groupLabel: string;
  primaryLabel: string;
  overlayLabel: string;
  primaryIcon: ReactNode;
  overlayIcon: ReactNode;
  delivery: ShareRoundDelivery;
  roundImageBusy: string | null;
  disabled: boolean;
  onRoundImage: RoundImageActionsProps['onRoundImage'];
}) {
  const primaryBusy = roundImageBusy === busyKey(delivery, 'board');
  const overlayBusy = roundImageBusy === busyKey(delivery, 'overlay');

  return (
    <div className={styles.splitGroup} role="group" aria-label={groupLabel}>
      <button
        type="button"
        className={styles.splitBtn}
        disabled={disabled}
        data-busy={primaryBusy ? 'true' : undefined}
        aria-label={primaryLabel}
        title={primaryLabel}
        onClick={() => void onRoundImage('board', delivery)}
      >
        {primaryBusy ? (
          <span className={styles.busyGlyph} aria-hidden>
            ···
          </span>
        ) : (
          primaryIcon
        )}
      </button>
      <button
        type="button"
        className={styles.splitBtn}
        disabled={disabled}
        data-busy={overlayBusy ? 'true' : undefined}
        aria-label={overlayLabel}
        title={overlayLabel}
        onClick={() => void onRoundImage('overlay', delivery)}
      >
        {overlayBusy ? (
          <span className={styles.busyGlyph} aria-hidden>
            ···
          </span>
        ) : (
          overlayIcon
        )}
      </button>
    </div>
  );
}

export function RoundImageActions({
  systemShareAvailable,
  roundImageBusy,
  roundLogBusy = false,
  onRoundImage,
  onSaveRoundLog,
  className,
}: RoundImageActionsProps) {
  const disabled = roundImageBusy !== null || roundLogBusy;

  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')}>
      {onSaveRoundLog && (
        <button
          type="button"
          className={styles.singleBtn}
          disabled={disabled}
          data-busy={roundLogBusy ? 'true' : undefined}
          aria-label="Open round log"
          title="Open round log"
          onClick={onSaveRoundLog}
        >
          {roundLogBusy ? (
            <span className={styles.busyGlyph} aria-hidden>
              ···
            </span>
          ) : (
            <RoundLogIcon />
          )}
        </button>
      )}
      <SplitIconGroup
        groupLabel="Save round image"
        primaryLabel="Save board image"
        overlayLabel="Save board image with stats overlay"
        primaryIcon={<SaveImageIcon />}
        overlayIcon={<LayerGroupIcon />}
        delivery="save"
        roundImageBusy={roundImageBusy}
        disabled={disabled}
        onRoundImage={onRoundImage}
      />
      {systemShareAvailable && (
        <SplitIconGroup
          groupLabel="Share round image"
          primaryLabel="Share board image"
          overlayLabel="Share board image with stats overlay"
          primaryIcon={<ShareImageIcon />}
          overlayIcon={<LayerGroupIcon />}
          delivery="share"
          roundImageBusy={roundImageBusy}
          disabled={disabled}
          onRoundImage={onRoundImage}
        />
      )}
    </div>
  );
}
