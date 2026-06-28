import type { DominoTheme, PipRenderContext } from 'doubletwelve';

import styles from './warp-domino-theme.module.scss';

/** CSS-module effect modifiers — add a class here and a matching block in the SCSS file. */
const WARP_TILE_EFFECT_CLASSES = {
  holographic: styles.warpTileHolographic,
} as const;

const WARP_TILE_BG_CLASSES = {
  dark: styles.warpTileDark,
  light: styles.warpTileLight,
} as const;

/** Pip readout presets — styled via [data-pip-preset] on the tile root. */
const WARP_PIP_PRESETS = {
  classic: 'classic',
  bridge: 'bridge',
  lcars: 'lcars',
  okudagram: 'okudagram',
  isolinear: 'isolinear',
  warpCore: 'warpCore',
} as const;

export type WarpDominoEffect = keyof typeof WARP_TILE_EFFECT_CLASSES;

export type WarpTileBg = keyof typeof WARP_TILE_BG_CLASSES;

export type WarpPipPreset = keyof typeof WARP_PIP_PRESETS;

export const WARP_PIP_PRESET_ORDER: readonly WarpPipPreset[] = [
  'classic',
  'bridge',
  'lcars',
  'okudagram',
  'isolinear',
  'warpCore',
];

export const WARP_PIP_PRESET_META: Record<
  WarpPipPreset,
  { label: string; hint: string }
> = {
  classic: {
    label: 'Classic',
    hint: 'Traditional domino — solid pips, full contrast',
  },
  bridge: {
    label: 'Bridge',
    hint: 'Deflector display — soft cyan sensor glow',
  },
  lcars: {
    label: 'LCARS',
    hint: 'PADD readout — warm orange highlight, violet frame',
  },
  okudagram: {
    label: 'Okudagram',
    hint: 'Technical schematic — bracket rings and scan pulse',
  },
  isolinear: {
    label: 'Isolinear',
    hint: 'Optical chip — glassy rim with isolinear translucency',
  },
  warpCore: {
    label: 'Warp core',
    hint: 'Plasma injectors — bright core with energy pulse',
  },
};

export const WARP_TILE_BG_META: Record<
  WarpTileBg,
  { label: string; hint: string }
> = {
  dark: {
    label: 'Bridge dark',
    hint: 'Command console panel on deep space black',
  },
  light: {
    label: 'PADD light',
    hint: 'Light isolinear display surface',
  },
};

export const WARP_TILE_SURFACE = {
  dark: {
    fill: '#0a1220',
    border: '#334155',
  },
  light: {
    fill: '#eef2f7',
    border: '#94a3b8',
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
  /** Pip readout preset — positioning stays in DoubleTwelve. */
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

/** Compose base + enabled effect classes for DoubleTwelve tiles. */
export function composeWarpTileClassName(
  effects: WarpDominoEffects = {},
  _pipPreset: WarpPipPreset = 'bridge',
  tileBg: WarpTileBg = 'dark'
): string {
  const resolved = resolveWarpDominoEffects({ effects });

  return [
    styles.warpTile,
    WARP_TILE_BG_CLASSES[tileBg],
    ...(Object.keys(WARP_TILE_EFFECT_CLASSES) as WarpDominoEffect[])
      .filter((effect) => resolved[effect])
      .map((effect) => WARP_TILE_EFFECT_CLASSES[effect]),
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
    'pip-preset': pipPreset,
  };

  for (const [effect, enabled] of Object.entries(effects) as [
    WarpDominoEffect,
    boolean,
  ][]) {
    if (enabled) {
      attrs[effect] = true;
    }
  }

  return attrs;
}

/** Warp12 presentation layer for DoubleTwelve tiles — safe to swap or extend. */
export function createWarpDominoTheme(
  options: WarpDominoThemeOptions = {}
): DominoTheme {
  const effects = resolveWarpDominoEffects(options);
  const pipPreset = options.pipPreset ?? 'bridge';
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
    pipStyle: (ctx: PipRenderContext) => ({
      ['--pip-color' as string]: ctx.color,
      // Let theme CSS own pip paint and shape — DefaultPip otherwise sets solid circles.
      backgroundColor: 'transparent',
      border: 'none',
      boxShadow: 'none',
      borderRadius: undefined,
    }),
  };
}
