import { useEffect } from 'react';

import {
  WARP_PIP_PRESET_META,
  WARP_PIP_PRESET_ORDER,
  WARP_TILE_BG_META,
  type WarpPipPreset,
  type WarpTileBg,
} from '../theme/warp-domino-theme';
import styles from './rules-view.module.scss';
import optionStyles from './table-options-dialog.module.scss';

export interface TableOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  layoutStyle: 'offset' | 'linear';
  onLayoutStyleChange: (next: 'offset' | 'linear') => void;
  tileBg: WarpTileBg;
  onTileBgChange: (next: WarpTileBg) => void;
  holographicTiles: boolean;
  onHolographicTilesChange: (next: boolean) => void;
  pipPreset: WarpPipPreset;
  onPipPresetChange: (next: WarpPipPreset) => void;
  teachingMode: boolean;
  onTeachingModeChange: (next: boolean) => void;
  autoFollowAction: boolean;
  onAutoFollowActionChange: (next: boolean) => void;
}

export function TableOptionsDialog({
  open,
  onClose,
  layoutStyle,
  onLayoutStyleChange,
  tileBg,
  onTileBgChange,
  holographicTiles,
  onHolographicTilesChange,
  pipPreset,
  onPipPresetChange,
  teachingMode,
  onTeachingModeChange,
  autoFollowAction,
  onAutoFollowActionChange,
}: TableOptionsDialogProps) {
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

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-table-options-title"
      onClick={onClose}
    >
      <div
        className={`${styles.dialogPanel} ${optionStyles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-table-options-title" className={styles.dialogTitle}>
            Table options
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className={`${styles.dialogBody} ${optionStyles.body}`}>
          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Trail layout</h3>
            <div className={optionStyles.row}>
              <button
                type="button"
                className={optionStyles.optionBtn}
                data-active={layoutStyle === 'offset'}
                onClick={() => onLayoutStyleChange('offset')}
              >
                Offset
              </button>
              <button
                type="button"
                className={optionStyles.optionBtn}
                data-active={layoutStyle === 'linear'}
                onClick={() => onLayoutStyleChange('linear')}
              >
                Linear
              </button>
            </div>
          </section>

          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Tile finish</h3>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={holographicTiles}
                onChange={(event) =>
                  onHolographicTilesChange(event.target.checked)
                }
              />
              <span>Holo display</span>
            </label>
            <div className={optionStyles.row}>
              {(['dark', 'light'] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  className={optionStyles.optionBtn}
                  disabled={holographicTiles}
                  data-active={tileBg === bg}
                  title={
                    holographicTiles
                      ? 'Turn off Holo display to change tile finish'
                      : WARP_TILE_BG_META[bg].hint
                  }
                  onClick={() => onTileBgChange(bg)}
                >
                  {WARP_TILE_BG_META[bg].label}
                </button>
              ))}
            </div>
          </section>

          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Table view</h3>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={autoFollowAction}
                onChange={(event) =>
                  onAutoFollowActionChange(event.target.checked)
                }
              />
              <span>Follow charted tiles</span>
            </label>
            <p className={optionStyles.hint}>
              {autoFollowAction
                ? 'Panning to each new coordinate as it is charted on the table.'
                : 'Turn on to auto-scroll the play area to wherever tiles are placed.'}
            </p>
          </section>

          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Advisor</h3>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={teachingMode}
                onChange={(event) => onTeachingModeChange(event.target.checked)}
              />
              <span>Teaching mode</span>
            </label>
            <p className={optionStyles.hint}>
              {teachingMode
                ? 'Tactical advisor stays on during your turn — suggestion and advice update as the board changes.'
                : 'Turn on to keep the advisor visible with move advice every turn (you still confirm each play).'}
            </p>
          </section>

          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Pip readout</h3>
            <div className={optionStyles.row}>
              {WARP_PIP_PRESET_ORDER.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={optionStyles.optionBtn}
                  data-active={pipPreset === preset}
                  title={WARP_PIP_PRESET_META[preset].hint}
                  onClick={() => onPipPresetChange(preset)}
                >
                  {WARP_PIP_PRESET_META[preset].label}
                </button>
              ))}
            </div>
            <p className={optionStyles.hint}>
              {WARP_PIP_PRESET_META[pipPreset].hint}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
