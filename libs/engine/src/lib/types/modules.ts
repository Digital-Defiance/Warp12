import type { FlashEffect } from './continuum.js';
import {
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  type SubspaceFractureScope,
} from './subspace-fracture-scope.js';

export type { SubspaceFractureScope } from './subspace-fracture-scope.js';
export type {
  HouseRules,
  HouseRulesConfig,
  DropToImpulseCatchPenalty,
  DoubleZeroScore,
} from './house-rules.js';
export {
  DEFAULT_HOUSE_RULES,
  resolveHouseRules,
} from './house-rules.js';
export {
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  SUBSPACE_FRACTURE_SCOPES,
  subspaceFractureAppliesToDouble,
} from './subspace-fracture-scope.js';

/** Module Alpha: The Q-Continuum — 0-0 triggers reality-bending rule changes. */
export interface QContinuumModule {
  readonly enabled: boolean;
  /** Active Continuum Flash effect for the current round, if any. */
  readonly activeFlash: QFlash | null;
}

export interface QFlash {
  readonly invokedBy: string;
  readonly effect: FlashEffect;
}

/** Module Beta: Salamander — held highest double (maxPip-maxPip) scores double its pips (round 2+). */
export interface SalamanderPenaltyModule {
  readonly enabled: boolean;
}

/** Module Gamma: Long-Range Sensor Sweep — visible market of tiles for strategic draws. */
export interface SensorGridModule {
  readonly enabled: boolean;
  readonly gridSize: number; // 4-5 tiles in the market
}

/** Module Delta: Warp Drive Spooling — draw from uncharted continuously until mismatch. */
export interface WarpDriveSpoolModule {
  readonly enabled: boolean;
}

/** Module Epsilon: Tactical Requisition — draft-based deal instead of random. */
export interface DraftingModule {
  readonly enabled: boolean;
  readonly packSize: number; // Tiles per pack (e.g., 15 for 2p W12)
}

/** Module Zeta: Fleet Squadrons — team play with shared trails. */
export interface SquadronsModule {
  readonly enabled: boolean;
  readonly squadronSize: number; // 2-3 captains per squadron
  /** Host-chosen squad names, index-aligned with formation order. */
  readonly squadronNames?: readonly string[];
  /**
   * Optional host-assigned membership (drag-roster). Each inner array is one
   * squad of `squadronSize` captain ids. When omitted, `formSquadrons`
   * round-robins from lobby seat order.
   */
  readonly squadronRosters?: readonly (readonly string[])[];
}

/** Module Theta: Longest Trail Bonus — captain with longest trail gets a scoring bonus. */
export interface LongestTrailModule {
  readonly enabled: boolean;
  readonly bonus: number; // Negative value (e.g., -3)
}

/** Module Iota: Double Down — playing a double forces next player to draw extra tiles. */
export interface DoubleDownModule {
  readonly enabled: boolean;
  readonly drawCount: number; // Number of tiles to draw (e.g., 2)
}

/** Module Kappa: Temporal Inversion — alternating rounds have inverted scoring (highest wins). */
export interface TemporalInversionModule {
  readonly enabled: boolean;
}

/** Module Eta: Temporal Debt — drawing from uncharted accumulates debt tokens, pay penalty at round end. */
export interface TemporalDebtModule {
  readonly enabled: boolean;
  readonly costPerToken: number; // Points per debt token (e.g., 2)
}

/** Module Lambda: Wormholes — playing double on Neutral Zone swaps captain's trail with NZ. */
export interface WormholesModule {
  readonly enabled: boolean;
}

/** Subspace Fracture (chicken foot) — scope controls which doubles open a fracture. */
export interface SubspaceFractureModule {
  readonly enabled: boolean;
  readonly scope: SubspaceFractureScope;
}

export interface GameModules {
  readonly continuum: QContinuumModule;
  readonly salamanderPenalty: SalamanderPenaltyModule;
  readonly sensorGrid: SensorGridModule;
  readonly warpDriveSpool: WarpDriveSpoolModule;
  readonly drafting: DraftingModule;
  readonly squadrons: SquadronsModule;
  readonly longestTrail: LongestTrailModule;
  readonly doubleDown: DoubleDownModule;
  readonly temporalDebt: TemporalDebtModule;
  readonly temporalInversion: TemporalInversionModule;
  readonly wormholes: WormholesModule;
  readonly subspaceFracture: SubspaceFractureModule;
}

export const DEFAULT_MODULES: GameModules = {
  continuum: { enabled: false, activeFlash: null },
  salamanderPenalty: { enabled: false },
  sensorGrid: { enabled: false, gridSize: 5 },
  warpDriveSpool: { enabled: false },
  drafting: { enabled: false, packSize: 15 },
  squadrons: { enabled: false, squadronSize: 2 },
  longestTrail: { enabled: false, bonus: -3 },
  doubleDown: { enabled: false, drawCount: 2 },
  temporalDebt: { enabled: false, costPerToken: 2 },
  temporalInversion: { enabled: false },
  wormholes: { enabled: false },
  subspaceFracture: { enabled: false, scope: DEFAULT_SUBSPACE_FRACTURE_SCOPE },
};

export interface GameModuleConfig {
  continuum?: boolean;
  salamanderPenalty?: boolean;
  sensorGrid?: boolean;
  sensorGridSize?: number;
  warpDriveSpool?: boolean;
  drafting?: boolean;
  draftingPackSize?: number;
  squadrons?: boolean;
  squadronSize?: number;
  /** Host-chosen squad names, index-aligned with formation order. */
  squadronNames?: readonly string[];
  /** Host-assigned squad membership; see {@link SquadronsModule.squadronRosters}. */
  squadronRosters?: readonly (readonly string[])[];
  longestTrail?: boolean;
  longestTrailBonus?: number;
  doubleDown?: boolean;
  doubleDownDrawCount?: number;
  temporalDebt?: boolean;
  temporalDebtCost?: number;
  temporalInversion?: boolean;
  wormholes?: boolean;
  subspaceFracture?: boolean;
  subspaceFractureScope?: SubspaceFractureScope;
}

/**
 * Exhibition / party modules that must never update TEI (RULES §VI Warped,
 * tei-spec E8). Module Zeta (squadrons) is *not* Warped — it is gated separately
 * via `SQUADRONS_RATING_CALIBRATED` (squadRating track when true).
 */
export type WarpedModuleKey =
  | 'drafting'
  | 'temporalInversion'
  | 'wormholes';

/** Flat lobby / Firestore view of which Warped modules are enabled. */
export function warpedModuleKeys(
  config: GameModuleConfig | null | undefined
): WarpedModuleKey[] {
  if (!config) {
    return [];
  }
  const keys: WarpedModuleKey[] = [];
  if (config.drafting === true) {
    keys.push('drafting');
  }
  if (config.temporalInversion === true) {
    keys.push('temporalInversion');
  }
  if (config.wormholes === true) {
    keys.push('wormholes');
  }
  return keys;
}

export function hasWarpedModules(
  config: GameModuleConfig | null | undefined
): boolean {
  return warpedModuleKeys(config).length > 0;
}

/** Flatten resolved engine modules back to the lobby/Firestore config shape. */
export function toModuleConfig(modules: GameModules): GameModuleConfig {
  return {
    continuum: modules.continuum.enabled,
    salamanderPenalty: modules.salamanderPenalty.enabled,
    sensorGrid: modules.sensorGrid.enabled,
    sensorGridSize: modules.sensorGrid.gridSize,
    warpDriveSpool: modules.warpDriveSpool.enabled,
    drafting: modules.drafting.enabled,
    draftingPackSize: modules.drafting.packSize,
    squadrons: modules.squadrons.enabled,
    squadronSize: modules.squadrons.squadronSize,
    ...(modules.squadrons.squadronNames
      ? { squadronNames: modules.squadrons.squadronNames }
      : {}),
    ...(modules.squadrons.squadronRosters
      ? { squadronRosters: modules.squadrons.squadronRosters }
      : {}),
    longestTrail: modules.longestTrail.enabled,
    longestTrailBonus: modules.longestTrail.bonus,
    doubleDown: modules.doubleDown.enabled,
    doubleDownDrawCount: modules.doubleDown.drawCount,
    temporalDebt: modules.temporalDebt.enabled,
    temporalDebtCost: modules.temporalDebt.costPerToken,
    temporalInversion: modules.temporalInversion.enabled,
    wormholes: modules.wormholes.enabled,
    subspaceFracture: modules.subspaceFracture.enabled,
    subspaceFractureScope: modules.subspaceFracture.scope,
  };
}

export function resolveModules(config: GameModuleConfig = {}): GameModules {
  return {
    continuum: {
      enabled: config.continuum ?? false,
      activeFlash: null,
    },
    salamanderPenalty: {
      enabled: config.salamanderPenalty ?? false,
    },
    sensorGrid: {
      enabled: config.sensorGrid ?? false,
      gridSize: config.sensorGridSize ?? 5,
    },
    warpDriveSpool: {
      enabled: config.warpDriveSpool ?? false,
    },
    drafting: {
      enabled: config.drafting ?? false,
      packSize: config.draftingPackSize ?? 15,
    },
    squadrons: {
      enabled: config.squadrons ?? false,
      squadronSize: config.squadronSize ?? 2,
      ...(config.squadronNames ? { squadronNames: config.squadronNames } : {}),
      ...(config.squadronRosters
        ? { squadronRosters: config.squadronRosters }
        : {}),
    },
    longestTrail: {
      enabled: config.longestTrail ?? false,
      bonus: config.longestTrailBonus ?? -3,
    },
    doubleDown: {
      enabled: config.doubleDown ?? false,
      drawCount: config.doubleDownDrawCount ?? 2,
    },
    temporalDebt: {
      enabled: config.temporalDebt ?? false,
      costPerToken: config.temporalDebtCost ?? 2,
    },
    temporalInversion: {
      enabled: config.temporalInversion ?? false,
    },
    wormholes: {
      enabled: config.wormholes ?? false,
    },
    subspaceFracture: {
      enabled: config.subspaceFracture ?? false,
      scope: config.subspaceFractureScope ?? DEFAULT_SUBSPACE_FRACTURE_SCOPE,
    },
  };
}
