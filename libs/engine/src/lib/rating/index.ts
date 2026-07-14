/**
 * OpenSkill-based rating system for Warp 12.
 * Exports all rating types, utilities, and update functions.
 */

export type { PlayerRating, RatingTrack } from './types.js';
export {
  DEFAULT_RATING,
  PROVISIONAL_SIGMA_THRESHOLD,
  displayRating,
  ordinalRating,
  isProvisional,
  formatDisplayRating,
  formatFullRating,
} from './types.js';

export {
  toOpenSkillRating,
  fromOpenSkillRating,
  updateRatings,
  calculateOrdinal,
  DEFAULT_OPTIONS,
} from './openskill-adapter.js';

export type { FFAPlayer } from './update-ffa.js';
export { updateFFARatings, updateHeadToHead } from './update-ffa.js';

export type { TeamMember, Team } from './update-team.js';
export { updateTeamRatings, updateTwoTeamMatch } from './update-team.js';

export type { AiSkillLevel } from './update-vs-ai.js';
export { updateVsAI, updateMixedTable } from './update-vs-ai.js';

export {
  INITIAL_ANCHORS,
  ANCHORS_CALIBRATED,
  SQUADRONS_RATING_CALIBRATED,
  getAIAnchor,
} from './anchors.js';

export type { TeiGrade, TeiDisplay } from './tei-grade.js';
export {
  getTeiGrade,
  getTeiScore,
  getTeiDisplay,
  isTeiProvisional,
  getTeiGradeName,
  getTeiGradeDescription,
  getTeiGradeColor,
  previewTeiChange,
  DEFAULT_TEI_CONFIG,
  type TeiScoreConfig,
} from './tei-grade.js';

export type { TeiRankId, TeiRank } from './tei-rank.js';
export {
  TEI_RANKS,
  compareTeiDisplay,
  getTeiRank,
  getTeiRankFromFormatted,
  isFlagOfficerRank,
  parseTeiFormatted,
} from './tei-rank.js';
