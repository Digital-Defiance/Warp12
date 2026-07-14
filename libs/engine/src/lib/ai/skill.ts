import { SKILL_PRESETS, type SkillProfile } from 'double-eighteen';
import type { GameObjective } from '../types/objective.js';
import type { LookaheadOptions } from './lookahead-options.js';
import { resolveDeepThinkAdvisorLookahead } from './fleet-admiral.js';
import { resolveGoOutTuning, type GoOutTuning } from './go-out-tuning.js';
import { WARP_HEURISTIC_IDS } from './heuristics.js';

const H = WARP_HEURISTIC_IDS;

/** Warp skill profile — DoubleEighteen {@link SkillProfile} plus optional go-out tuning. */
export type WarpSkillProfile = SkillProfile & {
  goOutTuning?: Partial<GoOutTuning>;
};

const POINTS_PRESETS: Record<
  'ensign' | 'lieutenant' | 'commander',
  SkillProfile
> = {
  ensign: {
    ...SKILL_PRESETS.beginner,
    enabled: new Set([
      H.preferChart,
      H.dumpPips,
      H.dropToImpulseDeclare,
      H.dropToImpulseCatch,
      H.dropToImpulseForget,
      H.squadCoordination,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.dumpPips]: 0.2,
      [H.dropToImpulseDeclare]: 0.35,
      [H.dropToImpulseCatch]: 1,
      [H.dropToImpulseForget]: 0.8,
      // Module Zeta: low coordination — Ensign barely favors the squad trail.
      [H.squadCoordination]: 0.2,
    },
  },
  lieutenant: {
    ...SKILL_PRESETS.intermediate,
    enabled: new Set([
      H.preferChart,
      H.dumpPips,
      H.doublesEarly,
      H.ownTrail,
      H.coverRelief,
      H.dropToImpulseDeclare,
      H.dropToImpulseCatch,
      H.squadCoordination,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.dumpPips]: 1,
      [H.doublesEarly]: 1,
      [H.ownTrail]: 1,
      [H.coverRelief]: 1,
      [H.dropToImpulseDeclare]: 1.2,
      [H.dropToImpulseCatch]: 1.5,
      // Module Zeta: medium coordination.
      [H.squadCoordination]: 0.5,
    },
  },
  commander: {
    ...SKILL_PRESETS.advanced,
    enabled: new Set([
      H.preferChart,
      H.dumpPips,
      H.doublesEarly,
      H.ownTrail,
      H.coverRelief,
      H.redAlertSafe,
      H.handFlexibility,
      H.defensiveShared,
      H.salamanderDump,
      H.continuum,
      H.dropToImpulseDeclare,
      H.dropToImpulseCatch,
      H.squadCoordination,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.dumpPips]: 1.2,
      [H.doublesEarly]: 1.5,
      [H.ownTrail]: 1,
      [H.coverRelief]: 1.5,
      [H.redAlertSafe]: 1.5,
      [H.handFlexibility]: 1,
      [H.defensiveShared]: 1.5,
      [H.salamanderDump]: 2,
      [H.continuum]: 1.5,
      [H.dropToImpulseDeclare]: 1.5,
      [H.dropToImpulseCatch]: 2,
      // Module Zeta: high coordination — Commander actively favors the squad trail.
      [H.squadCoordination]: 0.8,
    },
  },
};

/** First-out mode: tempo and connectivity beat pip dumping. */
const GO_OUT_PRESETS: Record<
  'ensign' | 'lieutenant' | 'commander',
  WarpSkillProfile
> = {
  ensign: {
    ...SKILL_PRESETS.beginner,
    temperature: 5.4,
    blunderRate: 0.56,
    enabled: new Set([
      H.preferChart,
      H.goOutDrawReluctance,
      H.dropToImpulseDeclare,
      H.dropToImpulseCatch,
      H.dropToImpulseForget,
      H.squadCoordination,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.goOutDrawReluctance]: 0.35,
      [H.dropToImpulseDeclare]: 0.25,
      [H.dropToImpulseCatch]: 0.6,
      [H.dropToImpulseForget]: 0.5,
      // Module Zeta: low coordination — Ensign barely favors the squad trail.
      [H.squadCoordination]: 0.2,
    },
    goOutTuning: {
      drawReluctanceHandSize: 6,
    },
  },
  lieutenant: {
    ...SKILL_PRESETS.intermediate,
    temperature: 0.7,
    blunderRate: 0.12,
    enabled: new Set([
      H.preferChart,
      H.goOutWin,
      H.goOutTrailPriority,
      H.goOutNeutralZoneDump,
      H.goOutOpponentTrailDump,
      H.goOutAvoidMayhem,
      H.goOutBlockLeader,
      H.goOutDrawReluctance,
      H.goOutBeaconDiscipline,
      H.goOutFeasibility,
      H.doublesEarly,
      H.ownTrail,
      H.handFlexibility,
      H.redAlertSafe,
      H.dropToImpulseDeclare,
      H.dropToImpulseCatch,
      H.squadCoordination,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.goOutWin]: 1.05,
      [H.goOutTrailPriority]: 0.85,
      [H.goOutNeutralZoneDump]: 1,
      [H.goOutOpponentTrailDump]: 0.93,
      [H.goOutAvoidMayhem]: 1.31,
      [H.goOutBlockLeader]: 1.02,
      [H.goOutDrawReluctance]: 1,
      [H.goOutBeaconDiscipline]: 0.7,
      [H.goOutFeasibility]: 0.53,
      [H.doublesEarly]: 0.8,
      [H.ownTrail]: 0.9,
      [H.handFlexibility]: 1.42,
      [H.redAlertSafe]: 1,
      [H.dropToImpulseDeclare]: 1,
      [H.dropToImpulseCatch]: 1.2,
      // Module Zeta: medium coordination.
      [H.squadCoordination]: 0.5,
    },
  },
  commander: {
    ...SKILL_PRESETS.advanced,
    temperature: 0.08,
    blunderRate: 0,
    lookaheadDepth: 0,
    enabled: new Set([
      H.preferChart,
      H.goOutWin,
      H.goOutTrailPriority,
      H.goOutNeutralZoneDump,
      H.goOutOpponentTrailDump,
      H.goOutAvoidMayhem,
      H.goOutBlockLeader,
      H.goOutDrawReluctance,
      H.goOutBeaconDiscipline,
      H.goOutFeasibility,
      H.doublesEarly,
      H.ownTrail,
      H.handFlexibility,
      H.redAlertSafe,
      H.coverRelief,
      H.dropToImpulseDeclare,
      H.dropToImpulseCatch,
      H.squadCoordination,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.goOutWin]: 2.7,
      [H.goOutTrailPriority]: 1.55,
      [H.goOutNeutralZoneDump]: 1.2,
      [H.goOutOpponentTrailDump]: 1,
      [H.goOutAvoidMayhem]: 1,
      [H.goOutBlockLeader]: 1.6,
      [H.goOutDrawReluctance]: 1.3,
      [H.goOutBeaconDiscipline]: 1,
      [H.goOutFeasibility]: 1.85,
      [H.doublesEarly]: 0.95,
      [H.ownTrail]: 1.3,
      [H.handFlexibility]: 3.4,
      [H.redAlertSafe]: 1.2,
      [H.coverRelief]: 0.6,
      [H.dropToImpulseDeclare]: 1.2,
      [H.dropToImpulseCatch]: 1.5,
      // Module Zeta: high coordination — Commander actively favors the squad trail.
      [H.squadCoordination]: 0.8,
    },
    goOutTuning: {
      blockLeaderHandSize: 3,
      mayhemDoublePenalty: 40,
    },
  },
};

/** Optional override for weight-optimizer / calibration experiments. */
let goOutPresetsOverride: Record<
  'ensign' | 'lieutenant' | 'commander',
  WarpSkillProfile
> | null = null;

export function setGoOutPresetsOverride(
  presets: Record<
    'ensign' | 'lieutenant' | 'commander',
    WarpSkillProfile
  > | null
): void {
  goOutPresetsOverride = presets;
}

export function cloneGoOutPresets(): Record<
  'ensign' | 'lieutenant' | 'commander',
  WarpSkillProfile
> {
  const source = goOutPresetsOverride ?? GO_OUT_PRESETS;
  return {
    ensign: {
      ...source.ensign,
      enabled: new Set(source.ensign.enabled),
      weights: { ...source.ensign.weights },
      goOutTuning: source.ensign.goOutTuning
        ? { ...source.ensign.goOutTuning }
        : undefined,
    },
    lieutenant: {
      ...source.lieutenant,
      enabled: new Set(source.lieutenant.enabled),
      weights: { ...source.lieutenant.weights },
      goOutTuning: source.lieutenant.goOutTuning
        ? { ...source.lieutenant.goOutTuning }
        : undefined,
    },
    commander: {
      ...source.commander,
      enabled: new Set(source.commander.enabled),
      weights: { ...source.commander.weights },
      goOutTuning: source.commander.goOutTuning
        ? { ...source.commander.goOutTuning }
        : undefined,
    },
  };
}

export const WARP_SKILL_PRESETS = POINTS_PRESETS;

export type WarpSkillLevel = keyof typeof POINTS_PRESETS;

function scaleWeights(
  weights: SkillProfile['weights'],
  multipliers: Partial<Record<string, number>>
): SkillProfile['weights'] {
  const next = { ...weights };
  for (const [key, factor] of Object.entries(multipliers)) {
    if (next[key] !== undefined && factor !== undefined) {
      next[key] = next[key] * factor;
    }
  }
  return next;
}

export type WarpTableRole = 'focus' | 'opponent';

/** Go-out tempo tweaks by table size — local play is usually 4 captains. */
function applyGoOutTableSize(
  profile: WarpSkillProfile,
  level: WarpSkillLevel,
  playerCount: number,
  tableRole?: WarpTableRole
): WarpSkillProfile {
  if (playerCount <= 2) {
    if (level === 'ensign') {
      return {
        ...profile,
        blunderRate: Math.min(0.68, profile.blunderRate + 0.06),
        temperature: profile.temperature * 1.08,
      };
    }
    if (level === 'lieutenant') {
      return {
        ...profile,
        blunderRate: Math.min(0.22, profile.blunderRate + 0.08),
      };
    }
    if (level === 'commander') {
      return {
        ...profile,
        weights: scaleWeights(profile.weights, {
          [H.goOutWin]: 1.1,
          [H.handFlexibility]: 1.08,
        }),
      };
    }
    return profile;
  }

  const tablePressure =
    playerCount <= 4
      ? (playerCount - 2) / 2
      : 1 + (playerCount - 4) * 0.12;
  const isOpponent = tableRole === 'opponent';
  const isFocus = tableRole === 'focus';

  if (level === 'ensign') {
    return {
      ...profile,
      blunderRate: Math.min(
        0.72,
        profile.blunderRate + 0.2 * tablePressure
      ),
      temperature: profile.temperature * (1 + 0.22 * tablePressure),
    };
  }

  if (level === 'lieutenant') {
    if (isOpponent) {
      return {
        ...profile,
        blunderRate: Math.min(
          0.4,
          profile.blunderRate + 0.24 * tablePressure
        ),
        temperature: profile.temperature * (1 + 0.18 * tablePressure),
        weights: scaleWeights(profile.weights, {
          [H.goOutWin]: 1 - 0.18 * tablePressure,
          [H.goOutTrailPriority]: 1 - 0.15 * tablePressure,
        }),
      };
    }
    if (isFocus) {
      return {
        ...profile,
        weights: scaleWeights(profile.weights, {
          [H.goOutWin]: 1 + 0.06 * tablePressure,
          [H.handFlexibility]: 1 + 0.04 * tablePressure,
          [H.goOutTrailPriority]: Math.max(
            0,
            1 - 0.4 * tablePressure
          ),
        }),
      };
    }
    return profile;
  }

  if (isFocus) {
    const weights = scaleWeights(profile.weights, {
      [H.goOutWin]: 1 + 0.95 * tablePressure,
      [H.handFlexibility]: 1 + 0.6 * tablePressure,
    });
    if (tablePressure >= 0.5) {
      weights[H.goOutTrailPriority] = 0;
      weights[H.goOutAvoidMayhem] = 0;
    } else {
      weights[H.goOutTrailPriority] =
        (weights[H.goOutTrailPriority] ?? 0) * (1 - 0.05 * tablePressure);
    }
    return { ...profile, weights };
  }

  return profile;
}

export function getWarpSkillProfile(
  level: WarpSkillLevel,
  objective: GameObjective = 'points',
  playerCount?: number,
  tableRole?: WarpTableRole
): WarpSkillProfile {
  const presets =
    objective === 'go-out'
      ? (goOutPresetsOverride ?? GO_OUT_PRESETS)
      : POINTS_PRESETS;
  const base = presets[level] as WarpSkillProfile;
  
  // Always clone to avoid mutating shared preset objects
  const cloned: WarpSkillProfile = {
    ...base,
    enabled: new Set(base.enabled),
    weights: { ...base.weights },
    goOutTuning: base.goOutTuning ? { ...base.goOutTuning } : undefined,
  };
  
  if (objective !== 'go-out' || playerCount === undefined) {
    return cloned;
  }
  return applyGoOutTableSize(cloned, level, playerCount, tableRole);
}

/**
 * Advanced profile for the live coach and post-game advisor report.
 * Never injects random mistakes (`blunderRate: 0`) and picks the top line
 * after search (`temperature: 0`).
 */
export function getAdvisorSkillProfile(
  objective: GameObjective = 'points',
  playerCount?: number
): WarpSkillProfile {
  const base = getWarpSkillProfile(
    'commander',
    objective,
    playerCount,
    'focus'
  );
  return {
    ...base,
    blunderRate: 0,
    temperature: 0,
  };
}

/** Forward search settings for coach / advisor — always ISMCTS in product builds. */
export function resolveAdvisorLookahead(): LookaheadOptions {
  if (
    typeof process !== 'undefined' &&
    process.env?.ADVISOR_SHALLOW === '1'
  ) {
    return { depth: 2, determinizations: 6, maxBranch: 6 };
  }
  return resolveDeepThinkAdvisorLookahead();
}

/** Resolved go-out phase tuning for a skill profile. */
export function resolveProfileGoOutTuning(
  profile: WarpSkillProfile
): GoOutTuning {
  return resolveGoOutTuning(profile.goOutTuning);
}

/**
 * Lookahead baked into each tier for rating calibration — not user-configurable.
 * Beginner/lieutenant: greedy heuristics only.
 * Advanced go-out: depth 2 at 2p only; greedy at 3+ (multi-opponent race / search noise).
 * Advanced points: greedy (search hurt calibration at 2p).
 */
export function resolveWarpLookahead(
  level: WarpSkillLevel,
  objective: GameObjective = 'points',
  playerCount?: number
): LookaheadOptions | undefined {
  if (objective !== 'go-out' || playerCount === undefined || playerCount >= 3) {
    return undefined;
  }
  if (level !== 'commander') {
    return undefined;
  }
  if (playerCount <= 2) {
    return { depth: 2, determinizations: 5, maxBranch: 6 };
  }
  return undefined;
}
