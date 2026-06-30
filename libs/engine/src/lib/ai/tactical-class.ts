import type { GameObjective } from '../types/objective.js';
import type { WarpSkillLevel } from './skill.js';

/** Engine AI profile keys — map to Tactical Class IV / III / II in all player-facing UI. */
export const WARP_SKILL_LEVELS: readonly WarpSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];

/** AI simulation tiers shown to players (Class I is human prestige only). */
export type AiTacticalClass = 'IV' | 'III' | 'II';

/** Full tactical classification including elite human tier. */
export type TacticalClass = 'I' | AiTacticalClass;

export const AI_SKILL_TACTICAL_CLASS: Record<WarpSkillLevel, AiTacticalClass> =
  {
    ensign: 'IV',
    lieutenant: 'III',
    commander: 'II',
  };

export const TACTICAL_CLASS_TAGLINES: Record<AiTacticalClass, string> = {
  IV: 'Provisional / New Profile',
  III: 'Competent / Standard',
  II: 'Veteran / Sharp',
};

export const CLASS_I_TAGLINE = 'Elite / Master';

export function aiSkillToTacticalClass(skill: WarpSkillLevel): AiTacticalClass {
  return AI_SKILL_TACTICAL_CLASS[skill];
}

export function formatTacticalClass(
  tacticalClass: TacticalClass | AiTacticalClass,
  options?: { short?: boolean }
): string {
  if (options?.short) {
    return `Cls ${tacticalClass}`;
  }
  return `Class ${tacticalClass}`;
}

export function formatTei(tei: number, reference = false): string {
  return reference ? `~TEI ${tei}` : `TEI ${tei}`;
}

/** Unrated setup — class plus human-readable profile tagline. */
export function formatAiSkillUnratedLabel(skill: WarpSkillLevel): string {
  const tacticalClass = aiSkillToTacticalClass(skill);
  return `${formatTacticalClass(tacticalClass)} — ${TACTICAL_CLASS_TAGLINES[tacticalClass]}`;
}

/** Rated setup — class anchored to reference matchmaking TEI. */
export function formatAiSkillRatedLabel(
  skill: WarpSkillLevel,
  referenceTei: number
): string {
  const tacticalClass = aiSkillToTacticalClass(skill);
  return `${formatTacticalClass(tacticalClass)} (${formatTei(referenceTei, true)})`;
}

/** Player tactical class from solo TEI (not chain-of-command rank). */
export function teiToPlayerTacticalClass(tei: number | null): TacticalClass {
  if (tei == null) {
    return 'IV';
  }
  if (tei < 1100) {
    return 'IV';
  }
  if (tei < 1350) {
    return 'III';
  }
  if (tei < 1650) {
    return 'II';
  }
  return 'I';
}

export function playerTacticalClassTagline(
  tacticalClass: TacticalClass
): string {
  if (tacticalClass === 'I') {
    return CLASS_I_TAGLINE;
  }
  return TACTICAL_CLASS_TAGLINES[tacticalClass];
}

export type RatedObjective = Extract<GameObjective, 'go-out' | 'penalty'>;

export interface AcademyTeiBand {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

/** TEI seed bands per AI profile tier and objective track. */
export const ACADEMY_TEI_BANDS: Record<
  RatedObjective,
  Record<WarpSkillLevel, AcademyTeiBand>
> = {
  penalty: {
    ensign: { min: 400, max: 1050, default: 1000 },
    lieutenant: { min: 1050, max: 1300, default: 1200 },
    commander: { min: 1300, max: 1800, default: 1400 },
  },
  'go-out': {
    ensign: { min: 400, max: 1125, default: 1000 },
    lieutenant: { min: 1125, max: 1375, default: 1250 },
    commander: { min: 1375, max: 1800, default: 1500 },
  },
};

export function academyTeiBand(
  skill: WarpSkillLevel,
  objective: RatedObjective
): AcademyTeiBand {
  return ACADEMY_TEI_BANDS[objective][skill];
}

export function clampAcademyTei(
  skill: WarpSkillLevel,
  tei: number,
  objective: RatedObjective
): number {
  const band = academyTeiBand(skill, objective);
  return Math.max(band.min, Math.min(band.max, Math.round(tei)));
}

export function defaultAcademyTei(
  skill: WarpSkillLevel,
  objective: RatedObjective
): number {
  return academyTeiBand(skill, objective).default;
}
