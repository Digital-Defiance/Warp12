import { useEffect } from 'react';

import {
  WARP_PIP_PRESET_META,
  WARP_PIP_PRESET_ORDER,
  WARP_TILE_BG_META,
  type WarpPipPreset,
  type WarpTileBg,
} from 'warp12-theme';
import type {
  ShareRoundDelivery,
  ShareRoundImageMode,
} from '../game/share-round.js';
import type { CaptainTailsDisplay } from './table-view-prefs';
import { RoundImageActions } from './round-image-actions';
import { forceReloadPage } from './force-reload';
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
  captainTailsHud: boolean;
  onCaptainTailsHudChange: (next: boolean) => void;
  captainTailsDisplay: CaptainTailsDisplay;
  onCaptainTailsDisplayChange: (next: CaptainTailsDisplay) => void;
  bridgeSoundsEnabled: boolean;
  onBridgeSoundsEnabledChange: (next: boolean) => void;
  turnBeepsEnabled: boolean;
  onTurnBeepsEnabledChange: (next: boolean) => void;
  showDebugExport?: boolean;
  debugExportBusy?: boolean;
  onExportDebug?: () => void | Promise<void>;
  showShareRound?: boolean;
  systemShareAvailable?: boolean;
  roundImageBusy?: string | null;
  onRoundImage?: (
    mode: ShareRoundImageMode,
    delivery: ShareRoundDelivery
  ) => void | Promise<void>;
  onOpenRoundLog?: () => void;
  onDownloadRoundLogJson?: () => void;
  roundLogBusy?: boolean;
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
  captainTailsHud,
  onCaptainTailsHudChange,
  captainTailsDisplay,
  onCaptainTailsDisplayChange,
  bridgeSoundsEnabled,
  onBridgeSoundsEnabledChange,
  turnBeepsEnabled,
  onTurnBeepsEnabledChange,
  showDebugExport = false,
  debugExportBusy = false,
  onExportDebug,
  showShareRound = false,
  systemShareAvailable = false,
  roundImageBusy = null,
  onRoundImage,
  onOpenRoundLog,
  onDownloadRoundLogJson,
  roundLogBusy = false,
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
            <h3 className={optionStyles.sectionTitle}>Quick look</h3>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={captainTailsHud}
                onChange={(event) =>
                  onCaptainTailsHudChange(event.target.checked)
                }
              />
              <span>Tails panel</span>
            </label>
            <div className={optionStyles.row}>
              <button
                type="button"
                className={optionStyles.optionBtn}
                disabled={!captainTailsHud}
                data-active={captainTailsDisplay === 'number'}
                onClick={() => onCaptainTailsDisplayChange('number')}
              >
                Coordinate
              </button>
              <button
                type="button"
                className={optionStyles.optionBtn}
                disabled={!captainTailsHud}
                data-active={captainTailsDisplay === 'domino'}
                onClick={() => onCaptainTailsDisplayChange('domino')}
              >
                Domino tile
              </button>
            </div>
            <p className={optionStyles.hint}>
              {captainTailsHud
                ? captainTailsDisplay === 'domino'
                  ? 'Floating panel — mini tile and coordinate for each captain and Neutral zone.'
                  : 'Floating panel — tail coordinate for each captain and Neutral zone (e.g. 6:12, 6:6).'
                : 'Turn on for a draggable panel listing each trail tail at a glance.'}
            </p>
          </section>

          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Sound</h3>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={bridgeSoundsEnabled}
                onChange={(event) =>
                  onBridgeSoundsEnabledChange(event.target.checked)
                }
              />
              <span>Bridge sounds</span>
            </label>
            <p className={optionStyles.hint}>
              {bridgeSoundsEnabled
                ? 'Loops ambient bridge noise in the background while you play — table alerts and turn beeps play on top.'
                : 'Turn on for a looping bridge ambience track under table sound effects.'}
            </p>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={turnBeepsEnabled}
                onChange={(event) =>
                  onTurnBeepsEnabledChange(event.target.checked)
                }
              />
              <span>Turn beeps</span>
            </label>
            <p className={optionStyles.hint}>
              {turnBeepsEnabled
                ? 'Plays a random computer beep for each captain turn — once per tile charted until helm passes.'
                : 'Turn on to hear a random musical chirp whenever anyone charts a coordinate.'}
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

          {showShareRound && onRoundImage && (
            <section className={optionStyles.section}>
              <h3 className={optionStyles.sectionTitle}>Share</h3>
              <RoundImageActions
                systemShareAvailable={systemShareAvailable}
                roundImageBusy={roundImageBusy}
                roundLogBusy={roundLogBusy}
                onRoundImage={onRoundImage}
                onOpenRoundLog={onOpenRoundLog}
                onDownloadRoundLogJson={onDownloadRoundLogJson}
              />
              <p className={optionStyles.hint}>
                Book icon opens the round log to review; curly-brace icon
                downloads structured JSON. Left save segment: board + logo. Right
                segment (layer group icon): adds stats overlay. Hover for
                labels; save downloads, share opens the system sheet.
              </p>
            </section>
          )}

          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Diagnostics</h3>
            <div className={optionStyles.actionRow}>
              <button
                type="button"
                className={optionStyles.actionBtn}
                onClick={() => void forceReloadPage()}
              >
                Force reload
              </button>
              {showDebugExport && onExportDebug && (
                <button
                  type="button"
                  className={optionStyles.actionBtn}
                  disabled={debugExportBusy}
                  onClick={() => void onExportDebug()}
                >
                  {debugExportBusy ? 'Exporting…' : 'Export debug log'}
                </button>
              )}
            </div>
            <p className={optionStyles.hint}>
              Force reload clears browser cache storage and refreshes the page —
              useful if subspace IWDF link state looks stale.
              {showDebugExport && onExportDebug
                ? ' Export debug log downloads a JSON snapshot for bug reports (host only).'
                : ''}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
