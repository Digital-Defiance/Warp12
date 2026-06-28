import { SKILL_PRESETS, type SkillProfile } from 'doubletwelve';
import type { GameObjective } from '../types/objective.js';
import { WARP_HEURISTIC_IDS } from './heuristics.js';

const H = WARP_HEURISTIC_IDS;

const PENALTY_PRESETS: Record<
  'beginner' | 'intermediate' | 'advanced',
  SkillProfile
> = {
  beginner: {
    ...SKILL_PRESETS.beginner,
    enabled: new Set([H.preferChart, H.dumpPips]),
    weights: {
      [H.preferChart]: 1,
      [H.dumpPips]: 0.2,
    },
  },
  intermediate: {
    ...SKILL_PRESETS.intermediate,
    enabled: new Set([
      H.preferChart,
      H.dumpPips,
      H.doublesEarly,
      H.ownTrail,
      H.coverRelief,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.dumpPips]: 1,
      [H.doublesEarly]: 1,
      [H.ownTrail]: 1,
      [H.coverRelief]: 1,
    },
  },
  advanced: {
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
      H.qContinuum,
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
      [H.qContinuum]: 1.5,
    },
  },
};

/** First-out mode: tempo and connectivity beat pip dumping. */
const GO_OUT_PRESETS: Record<
  'beginner' | 'intermediate' | 'advanced',
  SkillProfile
> = {
  beginner: {
    ...SKILL_PRESETS.beginner,
    enabled: new Set([H.preferChart, H.goOutWin, H.handFlexibility]),
    weights: {
      [H.preferChart]: 1,
      [H.goOutWin]: 1,
      [H.handFlexibility]: 0.5,
    },
  },
  intermediate: {
    ...SKILL_PRESETS.intermediate,
    enabled: new Set([
      H.preferChart,
      H.goOutWin,
      H.doublesEarly,
      H.ownTrail,
      H.coverRelief,
      H.handFlexibility,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.goOutWin]: 1.5,
      [H.doublesEarly]: 1,
      [H.ownTrail]: 1.2,
      [H.coverRelief]: 1,
      [H.handFlexibility]: 1.2,
    },
  },
  advanced: {
    ...SKILL_PRESETS.advanced,
    enabled: new Set([
      H.preferChart,
      H.goOutWin,
      H.doublesEarly,
      H.ownTrail,
      H.coverRelief,
      H.redAlertSafe,
      H.handFlexibility,
      H.defensiveShared,
      H.qContinuum,
    ]),
    weights: {
      [H.preferChart]: 1,
      [H.goOutWin]: 2,
      [H.doublesEarly]: 1.2,
      [H.ownTrail]: 1.5,
      [H.coverRelief]: 1.5,
      [H.redAlertSafe]: 1.5,
      [H.handFlexibility]: 1.5,
      [H.defensiveShared]: 1.5,
      [H.qContinuum]: 1,
    },
  },
};

export const WARP_SKILL_PRESETS = PENALTY_PRESETS;

export type WarpSkillLevel = keyof typeof PENALTY_PRESETS;

export function getWarpSkillProfile(
  level: WarpSkillLevel,
  objective: GameObjective = 'penalty'
): SkillProfile {
  const presets = objective === 'go-out' ? GO_OUT_PRESETS : PENALTY_PRESETS;
  return presets[level];
}
