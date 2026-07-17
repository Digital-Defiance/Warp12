import { useEffect, useState } from 'react';

import {
  WARP_PIP_PRESET_META,
  WARP_PIP_PRESET_ORDER,
  WARP_TILE_BG_META,
  type WarpPipPreset,
  type WarpTileBg,
} from 'warp12-theme';
import { useAnnounce } from '../a11y/live-announcer.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { userHasAdminRole } from '../firebase/warp-auth-roles.js';
import { isTauriWindows } from '../firebase/platform.js';
import { copyTextToClipboard } from '../game/deliver-file.js';
import { sectorInviteLinks } from '../game/sector-invite-urls.js';
import type {
  ShareRoundDelivery,
  ShareRoundImageMode,
} from '../game/share-round.js';
import {
  readHideAdminBanner,
  writeHideAdminBanner,
} from './admin-banner-prefs.js';
import type {
  CaptainTailsCoordinate,
  CaptainTailsDisplay,
} from './table-view-prefs';
import {
  DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS,
  sanitizeAutoFollowReturnDelayMs,
} from './follow-snap-back.js';
import { RoundImageActions } from './round-image-actions';
import { forceReloadPage } from './force-reload';
import { formatAppVersionLabel } from './app-version';
import { quitTauriApp } from './quit-app';
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
  /**
   * When false (rated sector), the Advisor section is omitted so teaching mode
   * cannot be enabled mid-match.
   */
  advisorAvailable?: boolean;
  /** When false, advisor is heuristics-only (Warp 9/15/18 exhibition). */
  advisorNeuralAvailable?: boolean;
  autoFollowAction: boolean;
  onAutoFollowActionChange: (next: boolean) => void;
  autoFollowReturn: boolean;
  onAutoFollowReturnChange: (next: boolean) => void;
  autoFollowReturnDelayMs: number;
  onAutoFollowReturnDelayMsChange: (next: number) => void;
  sectorStatusHud: boolean;
  onSectorStatusHudChange: (next: boolean) => void;
  captainTailsHud: boolean;
  onCaptainTailsHudChange: (next: boolean) => void;
  captainTailsDisplay: CaptainTailsDisplay;
  onCaptainTailsDisplayChange: (next: CaptainTailsDisplay) => void;
  captainTailsCoordinate: CaptainTailsCoordinate;
  onCaptainTailsCoordinateChange: (next: CaptainTailsCoordinate) => void;
  captainTailsTrailLength: boolean;
  onCaptainTailsTrailLengthChange: (next: boolean) => void;
  /** Phone layout — HUD labels and hide Fleet panel-only controls. */
  compactLayout?: boolean;
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
  /**
   * Online spectator watch URL (Options is the mid-mission place to copy it —
   * seats cannot join after launch; rated play has no free-text Subspace).
   */
  sectorInvite?: {
    code: string;
    allowSpectate: boolean;
    rated: boolean;
  } | null;
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
  advisorAvailable = true,
  advisorNeuralAvailable = true,
  autoFollowAction,
  onAutoFollowActionChange,
  autoFollowReturn,
  onAutoFollowReturnChange,
  autoFollowReturnDelayMs,
  onAutoFollowReturnDelayMsChange,
  sectorStatusHud,
  onSectorStatusHudChange,
  captainTailsHud,
  onCaptainTailsHudChange,
  captainTailsDisplay,
  onCaptainTailsDisplayChange,
  captainTailsCoordinate,
  onCaptainTailsCoordinateChange,
  captainTailsTrailLength,
  onCaptainTailsTrailLengthChange,
  compactLayout = false,
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
  sectorInvite = null,
}: TableOptionsDialogProps) {
  const announce = useAnnounce();
  const auth = useFirebaseAuth();
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hideAdminBanner, setHideAdminBanner] = useState(() =>
    readHideAdminBanner()
  );

  useEffect(() => {
    if (!open) {
      setInviteStatus(null);
    }
  }, [open]);
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
  useEffect(() => {
    if (open) {
      setHideAdminBanner(readHideAdminBanner());
    }
  }, [open]);

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
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={autoFollowReturn}
                disabled={!autoFollowAction}
                onChange={(event) =>
                  onAutoFollowReturnChange(event.target.checked)
                }
              />
              <span>Return view after delay</span>
            </label>
            <label className={optionStyles.fieldRow}>
              <span>Return view delay (ms)</span>
              <input
                type="number"
                inputMode="numeric"
                min={300}
                max={30000}
                step={100}
                value={autoFollowReturnDelayMs}
                disabled={!autoFollowAction || !autoFollowReturn}
                aria-label="Return view delay in milliseconds"
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw.trim() === '') {
                    return;
                  }
                  const next = Number(raw);
                  if (!Number.isFinite(next) || next <= 0) {
                    return;
                  }
                  onAutoFollowReturnDelayMsChange(Math.round(next));
                }}
                onBlur={(event) => {
                  onAutoFollowReturnDelayMsChange(
                    sanitizeAutoFollowReturnDelayMs(event.target.value) ||
                      DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS
                  );
                }}
              />
            </label>
            <p className={optionStyles.hint}>
              {autoFollowAction
                ? autoFollowReturn
                  ? 'Pans to each new coordinate, then eases back to your previous view after the delay. Pan, zoom, or a new chart before the delay cancels the return (a new chart keeps your original origin).'
                  : 'Panning to each new coordinate as it is charted on the table.'
                : 'Turn on to auto-scroll the play area to wherever tiles are placed.'}
            </p>
          </section>

          <section className={optionStyles.section}>
            <h3 className={optionStyles.sectionTitle}>Quick look</h3>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={sectorStatusHud}
                onChange={(event) =>
                  onSectorStatusHudChange(event.target.checked)
                }
              />
              <span>
                {compactLayout ? 'Sector Status HUD' : 'Sector Status panel'}
              </span>
            </label>
            <p className={optionStyles.hint}>
              {compactLayout
                ? sectorStatusHud
                  ? 'Draggable hologram projection for round, Spacedock, Uncharted, and alerts — not a dialog panel. Sensor Grid stays separate when Module Gamma is on.'
                  : 'Off by default on phones. Turn on for a translucent hologram readout — Sensor Grid still appears separately for sweeps when Gamma is on.'
                : sectorStatusHud
                  ? 'Round, Spacedock, Uncharted, alerts, and Sensor Grid in a draggable panel.'
                  : 'Hidden — when Module Gamma is on, a Sensor Grid panel still appears for sweeps.'}
            </p>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={captainTailsHud}
                onChange={(event) =>
                  onCaptainTailsHudChange(event.target.checked)
                }
              />
              <span>
                {compactLayout ? 'Fleet Status HUD' : 'Fleet Status panel'}
              </span>
            </label>
            {compactLayout ? (
              <>
                <div className={optionStyles.row}>
                  <button
                    type="button"
                    className={optionStyles.optionBtn}
                    disabled={!captainTailsHud}
                    data-active={captainTailsCoordinate !== 'off'}
                    onClick={() => onCaptainTailsCoordinateChange('full')}
                  >
                    Show open pip
                  </button>
                  <button
                    type="button"
                    className={optionStyles.optionBtn}
                    disabled={!captainTailsHud}
                    data-active={captainTailsCoordinate === 'off'}
                    onClick={() => onCaptainTailsCoordinateChange('off')}
                  >
                    Initials only
                  </button>
                </div>
                <p className={optionStyles.hint}>
                  {captainTailsHud
                    ? captainTailsCoordinate === 'off'
                      ? 'Edge HUD — captain initials and trail state only.'
                      : 'Edge HUD — initials, trail state, and open pip value.'
                    : 'Turn on for a slim edge HUD of each trail at a glance.'}
                </p>
              </>
            ) : (
              <>
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
            <div className={optionStyles.row}>
              {(
                [
                  ['full', 'X:Y'],
                  ['tail', 'Tail only'],
                  ['off', 'Off'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={optionStyles.optionBtn}
                  disabled={!captainTailsHud}
                  data-active={captainTailsCoordinate === value}
                  onClick={() => onCaptainTailsCoordinateChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={optionStyles.hint}>
              {captainTailsHud
                ? captainTailsCoordinate === 'off'
                  ? captainTailsDisplay === 'domino'
                    ? 'Coordinate readout hidden — mini tile only, freeing panel width.'
                    : 'Coordinate readout hidden — captains and Neutral zone by name only.'
                  : captainTailsCoordinate === 'tail'
                    ? 'Coordinate readout shows only the open tail value in play (e.g. 6).'
                    : captainTailsDisplay === 'domino'
                      ? 'Floating panel — mini tile and coordinate for each captain and Neutral zone.'
                      : 'Floating panel — tail coordinate for each captain and Neutral zone (e.g. 6:12, 6:6).'
                : 'Turn on for a draggable panel listing each trail tail at a glance.'}
            </p>
            <label className={optionStyles.checkboxRow}>
              <input
                type="checkbox"
                disabled={!captainTailsHud}
                checked={captainTailsTrailLength}
                onChange={(event) =>
                  onCaptainTailsTrailLengthChange(event.target.checked)
                }
              />
              <span>Trail length</span>
            </label>
            <p className={optionStyles.hint}>
              {captainTailsTrailLength
                ? 'Shows a tile-count badge per trail — handy for longest-trail play.'
                : 'Turn on to badge each trail with its current tile count.'}
            </p>
              </>
            )}
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

          {advisorAvailable && (
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
              {!advisorNeuralAvailable
                ? teachingMode
                  ? 'Exhibition set — advisor uses heuristics only until neural weights ship for this factor.'
                  : 'Exhibition set — advisor stays heuristics-only until neural weights ship for this factor.'
                : teachingMode
                  ? 'Tactical advisor stays on during your turn — suggestion and advice update as the board changes.'
                  : 'Turn on to keep the advisor visible with move advice every turn (you still confirm each play).'}
            </p>
          </section>
          )}

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
                labels; save downloads (or opens the share sheet on iPad), share
                opens the system sheet.
              </p>
            </section>
          )}

          {sectorInvite ? (
            <section className={optionStyles.section}>
              <h3 className={optionStyles.sectionTitle}>Spectator link</h3>
              <div className={optionStyles.actionRow}>
                <button
                  type="button"
                  className={optionStyles.actionBtn}
                  disabled={!sectorInvite.allowSpectate}
                  aria-label={
                    sectorInvite.allowSpectate
                      ? 'Copy spectator link'
                      : 'Copy spectator link (gallery closed)'
                  }
                  onClick={() => {
                    const { watchUrl } = sectorInviteLinks(sectorInvite.code);
                    void copyTextToClipboard(watchUrl)
                      .then(() => {
                        const msg = 'Spectator link copied.';
                        setInviteStatus(msg);
                        announce(msg, 'polite');
                      })
                      .catch(() => {
                        const msg = 'Could not copy spectator link.';
                        setInviteStatus(msg);
                        announce(msg, 'assertive');
                      });
                  }}
                >
                  Copy spectator link
                </button>
              </div>
              {inviteStatus ? (
                <p className={optionStyles.hint} role="status">
                  {inviteStatus}
                </p>
              ) : null}
              <p className={optionStyles.hint}>
                {sectorInvite.allowSpectate
                  ? sectorInvite.rated
                    ? 'Rated play keeps Subspace on quick hails — copy the watch URL here to share mid-mission. Seat invites only work in the lobby.'
                    : 'Share the public watch URL so captains without a seat can follow the table. Seat invites only work in the lobby.'
                  : 'Spectator gallery is closed for this sector (host or ops). Re-enable in the lobby or ask ops to reopen spectate.'}
              </p>
            </section>
          ) : null}

          {isAdmin ? (
            <section className={optionStyles.section}>
              <h3 className={optionStyles.sectionTitle}>Admin</h3>
              <label className={optionStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={hideAdminBanner}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setHideAdminBanner(next);
                    writeHideAdminBanner(next);
                    announce(
                      next
                        ? 'Admin banner hidden.'
                        : 'Admin banner visible.',
                      'polite'
                    );
                  }}
                />
                <span>Hide admin banner</span>
              </label>
              <p className={optionStyles.hint}>
                {hideAdminBanner
                  ? 'Red ADMIN strip is off — useful for screenshots. Turn off to show it again.'
                  : 'Hides the red ADMIN strip at the top of the Bridge (screenshots).'}
              </p>
            </section>
          ) : null}

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
                ? ' Export debug log downloads a JSON snapshot for bug reports (host only; on iPad opens the share sheet or copies).'
                : ''}
            </p>
            <p className={optionStyles.versionMeta}>
              Warp 12 {formatAppVersionLabel()}
            </p>
          </section>

          {isTauriWindows() && (
            <section className={optionStyles.section}>
              <h3 className={optionStyles.sectionTitle}>Application</h3>
              <div className={optionStyles.actionRow}>
                <button
                  type="button"
                  className={`${optionStyles.actionBtn} ${optionStyles.dangerBtn}`}
                  onClick={() => void quitTauriApp()}
                >
                  Quit Warp 12
                </button>
              </div>
              <p className={optionStyles.hint}>
                Closes the app. You can also use Alt+F4 or the window close
                button.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
