export type { WarpAiAction } from './actions.js';
export { toGameAction } from './actions.js';

export type { WarpAiObservation } from './observation.js';
export { observe } from './observation.js';

export type { WarpEvalContext } from './context.js';
export {
  buildWarpContext,
  collectPlacedCoordinates,
  connectingValueForRoute,
} from './context.js';

export { warpCandidateGenerator, warpOffTurnCandidateGenerator } from './candidate-generator.js';

export type { WarpHeuristic } from './heuristics.js';
export { WARP_HEURISTIC_IDS, DEFAULT_WARP_HEURISTICS } from './heuristics.js';

export type { WarpSkillLevel, WarpSkillProfile } from './skill.js';
export {
  WARP_SKILL_PRESETS,
  cloneGoOutPresets,
  getAdvisorSkillProfile,
  getWarpSkillProfile,
  resolveAdvisorLookahead,
  resolveProfileGoOutTuning,
  resolveWarpLookahead,
  setGoOutPresetsOverride,
} from './skill.js';

export {
  DEFAULT_GO_OUT_TUNING,
  resolveGoOutTuning,
  type GoOutTuning,
} from './go-out-tuning.js';

export type {
  CreateWarpAiPlayerOptions,
  WarpAiPlayer,
} from './create-warp-ai.js';
export type { LookaheadOptions } from './lookahead-options.js';
export { createWarpAiPlayer } from './create-warp-ai.js';

export { explainWarpAiAction } from './explain-action.js';
export { explainTurnResolution } from './explain-turn-resolution.js';

export {
  buildAdvisorReport,
  reviewAdvisorMove,
  type AdvisorActionLogEntry,
  type AdvisorMoveReview,
  type AdvisorMoveStrength,
  type AdvisorReport,
  type BuildAdvisorReportOptions,
} from './advisor-report.js';
export {
  coordinateLabel,
  gameActionToWarpAi,
  warpAiActionKey,
} from './from-game-action.js';

export { chooseQFlashEffect, chooseQGambleKeepIndex } from './q-flash.js';

export {
  createWarpSearchModel,
  observationToState,
  warpLeafEval,
  handPips,
} from './search-model.js';

export type {
  SelfPlaySeat,
  PlaySelfPlayGameOptions,
  SelfPlayGameResult,
  SelfPlayMatchResult,
} from './self-play.js';
export { playSelfPlayGame, runSelfPlayMatch, blockedRoundWinner } from './self-play.js';

export type {
  SkillMatchup,
  SkillMatchupResult,
  FocusMatchupResult,
  FourPlayerFocusResult,
  CalibrationPlayerCount,
} from './ai-elo-calibration.js';
export {
  AI_SKILL_LEVELS,
  CALIBRATION_PLAYER_COUNTS,
  GO_OUT_REFERENCE_AI_ELO,
  REFERENCE_AI_ELO,
  referenceEloForObjective,
  SKILL_MATCHUPS,
  expectedWinRate,
  formatFocusMatchupResult,
  formatFourPlayerFocusResult,
  formatMatchupResult,
  impliedEloGap,
  makeFocusSeats,
  makeFourPlayerFocusSeats,
  makeHeadToHeadSeats,
  runCalibrationMatrix,
  runFocusMatchup,
  runFourPlayerFocusMatchup,
  runSkillMatchup,
} from './ai-elo-calibration.js';

