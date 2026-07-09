import type { WarpPipPreset, WarpTileBg } from 'warp12-theme';

export type CaptainTailsDisplay = 'number' | 'domino';
export type TrailLayoutStyle = 'offset' | 'linear';

export interface TableOptionsPrefs {
  layoutStyle: TrailLayoutStyle;
  tileBg: WarpTileBg;
  holographicTiles: boolean;
  pipPreset: WarpPipPreset;
  teachingMode: boolean;
  autoFollowAction: boolean;
  captainTailsHud: boolean;
  captainTailsDisplay: CaptainTailsDisplay;
  turnBeepsEnabled: boolean;
  /** Loop TNG bridge ambience under table SFX. */
  bridgeSoundsEnabled: boolean;
  /** When true, advisor report reviews every captain's charts (not just yours). */
  advisorIncludeAllCaptains: boolean;
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
  captainTailsHud: false,
  captainTailsDisplay: 'number',
  turnBeepsEnabled: false,
  bridgeSoundsEnabled: true,
  advisorIncludeAllCaptains: false,
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
  if (typeof value.captainTailsHud === 'boolean') {
    next.captainTailsHud = value.captainTailsHud;
  }
  if (value.captainTailsDisplay === 'number' || value.captainTailsDisplay === 'domino') {
    next.captainTailsDisplay = value.captainTailsDisplay;
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
