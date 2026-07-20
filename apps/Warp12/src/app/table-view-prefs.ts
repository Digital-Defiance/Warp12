import type { WarpPipPreset, WarpTileBg } from 'warp12-theme';

import {
  DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS,
  sanitizeAutoFollowReturnDelayMs,
} from './follow-snap-back.js';

export type CaptainTailsDisplay = 'number' | 'domino';
/** Tails-panel coordinate readout: full `X:Y`, tail (open) value only, or hidden. */
export type CaptainTailsCoordinate = 'full' | 'tail' | 'off';
export type TrailLayoutStyle = 'offset' | 'linear';
export type LogFontScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const LOG_FONT_SCALE_FACTOR: Record<LogFontScale, number> = {
  xs: 0.7,
  sm: 0.85,
  md: 1,
  lg: 1.2,
  xl: 1.45,
};

const LOG_FONT_SCALES = new Set<LogFontScale>(['xs', 'sm', 'md', 'lg', 'xl']);

export interface TableOptionsPrefs {
  layoutStyle: TrailLayoutStyle;
  tileBg: WarpTileBg;
  holographicTiles: boolean;
  pipPreset: WarpPipPreset;
  teachingMode: boolean;
  autoFollowAction: boolean;
  /**
   * After following a charted tile, ease the camera back to the pre-jump view
   * once `autoFollowReturnDelayMs` elapses (unless the user pans/zooms or
   * another tile is charted first).
   */
  autoFollowReturn: boolean;
  /** Dwell before snap-back, in milliseconds. */
  autoFollowReturnDelayMs: number;
  /**
   * Where “follow charted tiles” aims within the viewport (0–1 fractions).
   * Default 0.5/0.5 is geometric center; Set Focus lets captains account for
   * HUD chrome or off-center window layouts.
   */
  followFocusNormX: number;
  followFocusNormY: number;
  /** Round / Spacedock / Uncharted / alerts floating panel. */
  sectorStatusHud: boolean;
  captainTailsHud: boolean;
  captainTailsDisplay: CaptainTailsDisplay;
  captainTailsCoordinate: CaptainTailsCoordinate;
  /** Show the per-trail tile-count badge in the Fleet Status panel. */
  captainTailsTrailLength: boolean;
  turnBeepsEnabled: boolean;
  /** Loop TNG bridge ambience under table SFX. */
  bridgeSoundsEnabled: boolean;
  /** When true, advisor report reviews every captain's charts (not just yours). */
  advisorIncludeAllCaptains: boolean;
  /**
   * Persist full-match debug recording across sessions. When on, every local
   * match accumulates an AI-digestible action log until turned off.
   */
  recordMatchDebug: boolean;
  /**
   * Hide your private hand on this Bridge window (safe for OBS). Open
   * `/online/{code}/hand` on a second monitor to play.
   */
  hideHandOnBridge: boolean;
  /**
   * Pass-and-play couch mode: each human seat has a private hand window;
   * skip shared-device handoff overlays.
   */
  couchMode: boolean;
  /**
   * Admin-only: speak commentator highlights via Cloud Functions + ElevenLabs.
   */
  audibleCommentary: boolean;
  /**
   * Commentator mode: show round-elapsed timestamps (`MM:SS - …`) on highlight
   * lines. Fleet console always keeps timestamps.
   */
  commentatorShowElapsed: boolean;
  /** Scale for Bridge log ticker, sector log dialog, and commentary overlay. */
  logFontScale: LogFontScale;
}

const STORAGE_KEY = 'warp12-table-options';
const LEGACY_CAPTAIN_TAILS_KEY = 'warp12-captain-tails-hud';
const LEGACY_CAPTAIN_TAILS_DISPLAY_KEY = 'warp12-captain-tails-display';

export const DEFAULT_TABLE_OPTIONS: TableOptionsPrefs = {
  layoutStyle: 'offset',
  tileBg: 'dark',
  holographicTiles: true,
  pipPreset: 'classic',
  teachingMode: false,
  autoFollowAction: false,
  autoFollowReturn: false,
  autoFollowReturnDelayMs: DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS,
  followFocusNormX: 0.5,
  followFocusNormY: 0.5,
  // Desktop default on. Phone uses resolveSectorStatusHud() → off until toggled
  // (opaque panel was too heavy; hologram is opt-in). Module Gamma still gets
  // its own Sensor Grid panel either way.
  sectorStatusHud: true,
  captainTailsHud: false,
  captainTailsDisplay: 'number',
  captainTailsCoordinate: 'full',
  captainTailsTrailLength: true,
  turnBeepsEnabled: false,
  bridgeSoundsEnabled: true,
  advisorIncludeAllCaptains: false,
  recordMatchDebug: false,
  hideHandOnBridge: false,
  couchMode: false,
  audibleCommentary: false,
  commentatorShowElapsed: true,
  logFontScale: 'md',
};

const PIP_PRESETS = new Set<WarpPipPreset>([
  'classic',
  'bridge',
  'futuristic',
  'schematic',
  'isolinear',
  'warpCore',
]);

function readLegacyCaptainTailsHud(): boolean {
  try {
    return localStorage.getItem(LEGACY_CAPTAIN_TAILS_KEY) === 'true';
  } catch {
    return false;
  }
}

function readLegacyCaptainTailsDisplay(): CaptainTailsDisplay {
  try {
    const value = localStorage.getItem(LEGACY_CAPTAIN_TAILS_DISPLAY_KEY);
    if (value === 'number' || value === 'domino') {
      return value;
    }
  } catch {
    return 'number';
  }
  return 'number';
}

/** Clamp follow-focus fractions so the aim stays inside the playable viewport. */
export function sanitizeFollowFocusNorm(value: unknown, fallback = 0.5): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(0.92, Math.max(0.08, n));
}

function sanitizePartial(raw: unknown): Partial<TableOptionsPrefs> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const value = raw as Record<string, unknown>;
  const next: Partial<TableOptionsPrefs> = {};

  if (value.layoutStyle === 'offset' || value.layoutStyle === 'linear') {
    next.layoutStyle = value.layoutStyle;
  }
  if (value.tileBg === 'dark' || value.tileBg === 'light') {
    next.tileBg = value.tileBg;
  }
  if (typeof value.holographicTiles === 'boolean') {
    next.holographicTiles = value.holographicTiles;
  }
  if (
    typeof value.pipPreset === 'string' &&
    PIP_PRESETS.has(value.pipPreset as WarpPipPreset)
  ) {
    next.pipPreset = value.pipPreset as WarpPipPreset;
  }
  if (typeof value.teachingMode === 'boolean') {
    next.teachingMode = value.teachingMode;
  }
  if (typeof value.autoFollowAction === 'boolean') {
    next.autoFollowAction = value.autoFollowAction;
  }
  if (typeof value.autoFollowReturn === 'boolean') {
    next.autoFollowReturn = value.autoFollowReturn;
  }
  if (
    typeof value.autoFollowReturnDelayMs === 'number' ||
    typeof value.autoFollowReturnDelayMs === 'string'
  ) {
    next.autoFollowReturnDelayMs = sanitizeAutoFollowReturnDelayMs(
      value.autoFollowReturnDelayMs
    );
  }
  if (
    typeof value.followFocusNormX === 'number' ||
    typeof value.followFocusNormX === 'string'
  ) {
    next.followFocusNormX = sanitizeFollowFocusNorm(value.followFocusNormX);
  }
  if (
    typeof value.followFocusNormY === 'number' ||
    typeof value.followFocusNormY === 'string'
  ) {
    next.followFocusNormY = sanitizeFollowFocusNorm(value.followFocusNormY);
  }
  if (typeof value.sectorStatusHud === 'boolean') {
    next.sectorStatusHud = value.sectorStatusHud;
  }
  if (typeof value.captainTailsHud === 'boolean') {
    next.captainTailsHud = value.captainTailsHud;
  }
  if (value.captainTailsDisplay === 'number' || value.captainTailsDisplay === 'domino') {
    next.captainTailsDisplay = value.captainTailsDisplay;
  }
  if (
    value.captainTailsCoordinate === 'full' ||
    value.captainTailsCoordinate === 'tail' ||
    value.captainTailsCoordinate === 'off'
  ) {
    next.captainTailsCoordinate = value.captainTailsCoordinate;
  }
  if (typeof value.captainTailsTrailLength === 'boolean') {
    next.captainTailsTrailLength = value.captainTailsTrailLength;
  }
  if (typeof value.turnBeepsEnabled === 'boolean') {
    next.turnBeepsEnabled = value.turnBeepsEnabled;
  }
  if (typeof value.bridgeSoundsEnabled === 'boolean') {
    next.bridgeSoundsEnabled = value.bridgeSoundsEnabled;
  }
  if (typeof value.advisorIncludeAllCaptains === 'boolean') {
    next.advisorIncludeAllCaptains = value.advisorIncludeAllCaptains;
  }
  if (typeof value.recordMatchDebug === 'boolean') {
    next.recordMatchDebug = value.recordMatchDebug;
  }
  if (typeof value.hideHandOnBridge === 'boolean') {
    next.hideHandOnBridge = value.hideHandOnBridge;
  }
  if (typeof value.couchMode === 'boolean') {
    next.couchMode = value.couchMode;
  }
  if (typeof value.audibleCommentary === 'boolean') {
    next.audibleCommentary = value.audibleCommentary;
  }
  if (typeof value.commentatorShowElapsed === 'boolean') {
    next.commentatorShowElapsed = value.commentatorShowElapsed;
  }
  if (
    typeof value.logFontScale === 'string' &&
    LOG_FONT_SCALES.has(value.logFontScale as LogFontScale)
  ) {
    next.logFontScale = value.logFontScale as LogFontScale;
  }

  return next;
}

export function readTableOptions(): TableOptionsPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return {
        ...DEFAULT_TABLE_OPTIONS,
        ...sanitizePartial(JSON.parse(raw)),
      };
    }
  } catch {
    // fall through to legacy defaults
  }

  return {
    ...DEFAULT_TABLE_OPTIONS,
    captainTailsHud: readLegacyCaptainTailsHud(),
    captainTailsDisplay: readLegacyCaptainTailsDisplay(),
  };
}

export function writeTableOptions(patch: Partial<TableOptionsPrefs>): void {
  const next = { ...readTableOptions(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

/** True when the captain has explicitly saved a Sector Status preference. */
export function hasExplicitSectorStatusHudPref(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed.sectorStatusHud === 'boolean';
  } catch {
    return false;
  }
}

/**
 * Desktop defaults Sector Status on; phone defaults it off until the captain
 * toggles it (opaque panel was too heavy on mobile — hologram is opt-in).
 */
export function resolveSectorStatusHud(
  prefs: TableOptionsPrefs,
  compact: boolean
): boolean {
  if (!compact) {
    return prefs.sectorStatusHud;
  }
  if (hasExplicitSectorStatusHudPref()) {
    return prefs.sectorStatusHud;
  }
  return false;
}

/** @deprecated Use {@link readTableOptions}. */
export function readCaptainTailsHudEnabled(): boolean {
  return readTableOptions().captainTailsHud;
}

/** @deprecated Use {@link writeTableOptions}. */
export function writeCaptainTailsHudEnabled(enabled: boolean): void {
  writeTableOptions({ captainTailsHud: enabled });
}

/** @deprecated Use {@link readTableOptions}. */
export function readCaptainTailsDisplay(): CaptainTailsDisplay {
  return readTableOptions().captainTailsDisplay;
}

/** @deprecated Use {@link writeTableOptions}. */
export function writeCaptainTailsDisplay(display: CaptainTailsDisplay): void {
  writeTableOptions({ captainTailsDisplay: display });
}
