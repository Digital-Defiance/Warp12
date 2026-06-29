import type { QFlashEffect } from './q-continuum.js';
import {
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  type SubspaceFractureScope,
} from './subspace-fracture-scope.js';

export type { SubspaceFractureScope } from './subspace-fracture-scope.js';
export type { HouseRules, HouseRulesConfig } from './house-rules.js';
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
  /** Active Q-Flash effect for the current round, if any. */
  readonly activeFlash: QFlash | null;
}

export interface QFlash {
  readonly invokedBy: string;
  readonly effect: QFlashEffect;
}

/** Module Beta: The Salamander Penalty — holding 12-12 at round end costs 24 (round 2+). */
export interface SalamanderPenaltyModule {
  readonly enabled: boolean;
}

/** Subspace Fracture (chicken foot) — scope controls which doubles open a fracture. */
export interface SubspaceFractureModule {
  readonly enabled: boolean;
  readonly scope: SubspaceFractureScope;
}

export interface GameModules {
  readonly qContinuum: QContinuumModule;
  readonly salamanderPenalty: SalamanderPenaltyModule;
  readonly subspaceFracture: SubspaceFractureModule;
}

export const DEFAULT_MODULES: GameModules = {
  qContinuum: { enabled: false, activeFlash: null },
  salamanderPenalty: { enabled: false },
  subspaceFracture: { enabled: false, scope: DEFAULT_SUBSPACE_FRACTURE_SCOPE },
};

export interface GameModuleConfig {
  qContinuum?: boolean;
  salamanderPenalty?: boolean;
  subspaceFracture?: boolean;
  subspaceFractureScope?: SubspaceFractureScope;
}

export function resolveModules(config: GameModuleConfig = {}): GameModules {
  return {
    qContinuum: {
      enabled: config.qContinuum ?? false,
      activeFlash: null,
    },
    salamanderPenalty: {
      enabled: config.salamanderPenalty ?? false,
    },
    subspaceFracture: {
      enabled: config.subspaceFracture ?? false,
      scope: config.subspaceFractureScope ?? DEFAULT_SUBSPACE_FRACTURE_SCOPE,
    },
  };
}
