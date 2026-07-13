import type { GameObjective } from '../types/objective.js';
import { CLASS1_STAR_DISPLAY_NAME } from './class1-star-constants.js';
import { OMEGA_DISPLAY_NAME, OMEGA_SHORT_DISPLAY_NAME } from './omega-constants.js';
import type { WarpSkillLevel } from './skill.js';

/** Engine AI profile keys — map to Ensign / Lieutenant / Commander in player-facing UI. */
export const WARP_SKILL_LEVELS: readonly WarpSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];

/** AI simulation tiers shown to players (Flag Officer is human prestige only). */
export type AiTacticalClass = 'IV' | 'III' | 'II';

/** Full classification including elite human prestige tier. */
export type TacticalClass = 'I' | AiTacticalClass;

export const AI_SKILL_TACTICAL_CLASS: Record<WarpSkillLevel, AiTacticalClass> =
  {
    ensign: 'IV',
    lieutenant: 'III',
    commander: 'II',
  };

/** Commission / opponent labels (Ensign / Lieutenant / Commander / Flag Officer). */
const TACTICAL_CLASS_LABELS: Record<
  TacticalClass,
  { readonly short: string; readonly long: string }
> = {
  IV: { short: 'Ens.', long: 'Ensign' },
  III: { short: 'Lt.', long: 'Lieutenant' },
  II: { short: 'Cmdr.', long: 'Commander' },
  I: { short: 'Flag', long: 'Flag Officer' },
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
  const labels = TACTICAL_CLASS_LABELS[tacticalClass];
  return options?.short ? labels.short : labels.long;
}

/** Player-facing label for an AI officer (or experimental neural tiers). */
export function formatAiOfficerTacticalClass(
  skill: WarpSkillLevel,
  options?: { short?: boolean; class1Star?: boolean; omega?: boolean }
): string {
  if (options?.omega) {
    return options.short ? OMEGA_SHORT_DISPLAY_NAME : OMEGA_DISPLAY_NAME;
  }
  if (options?.class1Star) {
    return options.short ? 'I*' : CLASS1_STAR_DISPLAY_NAME;
  }
  return formatTacticalClass(aiSkillToTacticalClass(skill), {
    short: options?.short,
  });
}

export function formatTei(tei: number, reference = false): string {
  return reference ? `~TEI ${tei}` : `TEI ${tei}`;
}

/** Unrated setup — rank plus human-readable profile tagline. */
export function formatAiSkillUnratedLabel(skill: WarpSkillLevel): string {
  const tacticalClass = aiSkillToTacticalClass(skill);
  return `${formatTacticalClass(tacticalClass)} — ${TACTICAL_CLASS_TAGLINES[tacticalClass]}`;
}

/** Rated setup — rank anchored to reference matchmaking TEI. */
export function formatAiSkillRatedLabel(
  skill: WarpSkillLevel,
  referenceTei: number
): string {
  const tacticalClass = aiSkillToTacticalClass(skill);
  return `${formatTacticalClass(tacticalClass)} (${formatTei(referenceTei, true)})`;
}

/** Player commission tier from solo TEI (legacy numeric bands until grade-based mapping lands). */
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
  if (tei < 1450) {
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

export type RatedObjective = Extract<GameObjective, 'go-out' | 'points'>;

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
  points: {
    ensign: { min: 400, max: 1050, default: 1000 },
    lieutenant: { min: 1050, max: 1300, default: 1200 },
    commander: { min: 1420, max: 1700, default: 1520 },
  },
  'go-out': {
    ensign: { min: 400, max: 1125, default: 1000 },
    lieutenant: { min: 1125, max: 1375, default: 1250 },
    commander: { min: 1450, max: 1700, default: 1550 },
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
