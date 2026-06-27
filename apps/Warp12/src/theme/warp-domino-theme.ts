import type { DominoTheme } from 'doubletwelve';

import styles from './warp-domino-theme.module.scss';

/** CSS-module effect modifiers — add a class here and a matching block in the SCSS file. */
const WARP_TILE_EFFECT_CLASSES = {
  holographic: styles.warpTileHolographic,
} as const;

const WARP_TILE_BG_CLASSES = {
  dark: styles.warpTileDark,
  light: styles.warpTileLight,
} as const;

/** Pip appearance presets — experiment without touching inline styles or vendor code. */
const WARP_PIP_PRESET_CLASSES = {
  default: undefined,
  plasma: styles.warpTilePipPlasma,
  tactical: styles.warpTilePipTactical,
  active: styles.warpTilePipActive,
} as const;

export type WarpDominoEffect = keyof typeof WARP_TILE_EFFECT_CLASSES;

export type WarpTileBg = keyof typeof WARP_TILE_BG_CLASSES;

export type WarpPipPreset = keyof typeof WARP_PIP_PRESET_CLASSES;

export const WARP_TILE_SURFACE = {
  dark: {
    fill: '#0f172a',
    border: '#334155',
  },
  light: {
    fill: '#f8fafc',
    border: '#cbd5e1',
  },
} as const;

export type WarpDominoEffects = Partial<Record<WarpDominoEffect, boolean>>;

export interface WarpDominoThemeOptions {
  /** Toggle presentation modifiers (CSS module classes on each tile). */
  effects?: WarpDominoEffects;
  /** Shorthand for `effects.holographic`. */
  holographic?: boolean;
  /** Tile body fill when not in holographic mode. */
  tileBg?: WarpTileBg;
  /** Pip look preset — positioning stays in DoubleTwelve. */
  pipPreset?: WarpPipPreset;
}

function resolveWarpDominoEffects(
  options: WarpDominoThemeOptions = {}
): Record<WarpDominoEffect, boolean> {
  return {
    holographic:
      options.effects?.holographic ?? options.holographic ?? false,
  };
}

/** Compose base + enabled effect + pip preset classes for DoubleTwelve tiles. */
export function composeWarpTileClassName(
  effects: WarpDominoEffects = {},
  pipPreset: WarpPipPreset = 'default',
  tileBg: WarpTileBg = 'dark'
): string {
  const resolved = resolveWarpDominoEffects({ effects });
  const pipClass = resolved.holographic
    ? undefined
    : WARP_PIP_PRESET_CLASSES[pipPreset];

  return [
    styles.warpTile,
    WARP_TILE_BG_CLASSES[tileBg],
    ...(Object.keys(WARP_TILE_EFFECT_CLASSES) as WarpDominoEffect[])
      .filter((effect) => resolved[effect])
      .map((effect) => WARP_TILE_EFFECT_CLASSES[effect]),
    pipClass,
  ]
    .filter(Boolean)
    .join(' ');
}

function warpTileDataAttributes(
  effects: Record<WarpDominoEffect, boolean>,
  pipPreset: WarpPipPreset,
  tileBg: WarpTileBg
): DominoTheme['tileDataAttributes'] {
  const attrs: NonNullable<DominoTheme['tileDataAttributes']> = {
    warp: true,
    'tile-bg': tileBg,
  };

  for (const [effect, enabled] of Object.entries(effects) as [
    WarpDominoEffect,
    boolean,
  ][]) {
    if (enabled) {
      attrs[effect] = true;
    }
  }

  if (pipPreset !== 'default') {
    attrs['pip-preset'] = pipPreset;
  }

  return attrs;
}

/** Warp12 presentation layer for DoubleTwelve tiles — safe to swap or extend. */
export function createWarpDominoTheme(
  options: WarpDominoThemeOptions = {}
): DominoTheme {
  const effects = resolveWarpDominoEffects(options);
  const pipPreset = options.pipPreset ?? 'default';
  const tileBg = options.tileBg ?? 'dark';
  const surface = WARP_TILE_SURFACE[tileBg];

  return {
    tileClassName: composeWarpTileClassName(effects, pipPreset, tileBg),
    tileDataAttributes: warpTileDataAttributes(effects, pipPreset, tileBg),
    tileStyle: () =>
      effects.holographic
        ? {
            backgroundColor: 'transparent',
            boxShadow: 'none',
          }
        : {
            backgroundColor: surface.fill,
          },
    halfDividerStyle: () =>
      effects.holographic
        ? {
            borderBottomColor: 'rgba(56, 189, 248, 0.45)',
          }
        : {
            borderBottomColor: surface.border,
          },
    pipStyle: (ctx) => ({
      ['--pip-color' as string]: ctx.color,
    }),
  };
}
