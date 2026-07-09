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
  WARP_SKILL_LEVELS,
  AI_SKILL_TACTICAL_CLASS,
  TACTICAL_CLASS_TAGLINES,
  CLASS_I_TAGLINE,
  ACADEMY_TEI_BANDS,
  aiSkillToTacticalClass,
  formatAiOfficerTacticalClass,
  formatTacticalClass,
  formatTei,
  formatAiSkillUnratedLabel,
  formatAiSkillRatedLabel,
  teiToPlayerTacticalClass,
  playerTacticalClassTagline,
  academyTeiBand,
  clampAcademyTei,
  defaultAcademyTei,
  type AiTacticalClass,
  type TacticalClass,
  type AcademyTeiBand,
  type RatedObjective as SkillRatedObjective,
} from './tactical-class.js';
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

export {
  CLASS1_STAR_ACTION_KIND_DIM,
  CLASS1_STAR_CONTEXT_DIM,
  CLASS1_STAR_DISPLAY_NAME,
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_MODEL_VERSION,
  CLASS1_STAR_ROUTE_KIND_DIM,
  CLASS1_STAR_TILE_COUNT,
} from './class1-star-constants.js';
export {
  encodeClass1StarFeatureBatch,
  encodeClass1StarFeatures,
} from './feature-encoder.js';
export type {
  Class1StarDenseLayer,
  Class1StarModelWeights,
  Class1StarResidualScorer,
  Class1StarScore,
  Class1StarScoreBatch,
} from './residual-scorer.js';
export {
  createTsResidualScorer,
  createZeroClass1StarModelWeights,
  forwardClass1StarBatch,
  forwardClass1StarModel,
  isClass1StarScoreAsync,
  resolveClass1StarScores,
} from './residual-scorer.js';
export {
  augmentSearchValuesWithResidual,
  augmentSearchValuesWithResidualAsync,
  pickWarpActionWithResidual,
  pickWarpActionWithResidualAsync,
  scoreWarpCandidateHeuristic,
  scoreWarpCandidatesWithResidual,
  scoreWarpCandidatesWithResidualAsync,
} from './class1-star-policy.js';
export type { CreateClass1StarPlayerOptions } from './class1-star.js';
export {
  createClass1StarPlayer,
  getClass1StarSkillProfile,
} from './class1-star.js';

export type {
  Class1StarTrajectoryRow,
  Class1StarTrajectorySink,
  Class1StarCollectMode,
  CollectClass1StarTrajectoriesOptions,
  CollectClass1StarTrajectoriesResult,
} from './collect-class1-star-trajectories.js';
export {
  collectClass1StarTrajectories,
  collectClass1StarTrajectoriesToSink,
  formatClass1StarTrajectoryJsonl,
  serializeClass1StarTrajectoryRow,
} from './collect-class1-star-trajectories.js';

export type {
  BenchClass1StarOptions,
  BenchClass1StarResult,
  Class1StarAgreementResult,
} from './bench-class1-star.js';
export {
  benchClass1StarVsCommander,
  measureClass1StarCommanderAgreement,
} from './bench-class1-star.js';

export {
  OMEGA_DISPLAY_NAME,
  OMEGA_SHORT_DISPLAY_NAME,
  OMEGA_MODEL_VERSION,
  OMEGA_POLICY_FEATURE_DIM,
  OMEGA_STATE_FEATURE_DIM,
} from './omega-constants.js';
export {
  encodeOmegaPolicyFeatureBatch,
  encodeOmegaPolicyFeatures,
  encodeOmegaStateFeatures,
} from './omega-encoder.js';
export type { OmegaDenseLayer, OmegaModelWeights } from './omega-net.js';
export {
  createZeroOmegaModelWeights,
  forwardOmegaPolicyBatch,
  forwardOmegaPolicyLogit,
  forwardOmegaValue,
  softmax,
  validateOmegaModelWeights,
} from './omega-net.js';
export type { CreateOmegaPlayerOptions } from './omega-agent.js';
export { createOmegaPlayer } from './omega-agent.js';
export type {
  OmegaSearchOptions,
  OmegaSearchVisit,
} from './omega-search.js';
export { createOmegaSearchModel, omegaActionPriors, omegaSearchVisits } from './omega-search.js';
export type { CreateOmegaSearchPlayerOptions } from './omega-search-agent.js';
export { createOmegaSearchPlayer } from './omega-search-agent.js';
export {
  ADVISOR_ACTION_FEATURE_DIM,
  ADVISOR_DISPLAY_NAME,
  ADVISOR_MODEL_VERSION,
  ADVISOR_POLICY_FEATURE_DIM,
  ADVISOR_STATE_CONCEPT_DIM,
} from './advisor-constants.js';
export {
  ADVISOR_CONCEPT_IDS,
  advisorConceptLabel,
  computeAdvisorStateConcepts,
  explainAdvisorConcepts,
  rankAdvisorConcepts,
  type AdvisorConceptId,
} from './advisor-concepts.js';
export {
  encodeAdvisorActionFeatures,
  encodeAdvisorPolicyFeatureBatch,
  encodeAdvisorPolicyFeatures,
} from './advisor-encoder.js';
export type { AdvisorDenseLayer, AdvisorModelWeights } from './advisor-net.js';
export {
  createZeroAdvisorModelWeights,
  forwardAdvisorPolicyBatch,
  forwardAdvisorPolicyLogit,
  validateAdvisorModelWeights,
} from './advisor-net.js';
export type {
  AdvisorDecision,
  AdvisorPlayer,
  CreateAdvisorPlayerOptions,
} from './create-advisor-player.js';
export { createAdvisorPlayer } from './create-advisor-player.js';
export type {
  AdvisorTrajectoryRow,
  CollectAdvisorTrajectoriesOptions,
  CollectAdvisorTrajectoriesResult,
  AdvisorTrajectorySink,
} from './collect-advisor-trajectories.js';
export {
  collectAdvisorTrajectoriesToSink,
  serializeAdvisorTrajectoryRow,
} from './collect-advisor-trajectories.js';
export type {
  CollectOmegaTrajectoriesOptions,
  CollectOmegaTrajectoriesResult,
  OmegaTrajectoryRow,
  OmegaTrajectorySink,
} from './collect-omega-trajectories.js';
export {
  collectOmegaTrajectoriesToSink,
  serializeOmegaTrajectoryRow,
} from './collect-omega-trajectories.js';
export type { BenchOmegaOptions, BenchOmegaResult } from './bench-omega.js';
export { benchOmegaVsCommander } from './bench-omega.js';

export type {
  BenchFleetAdmiralOptions,
  BenchFleetAdmiralResult,
  BenchFleetAdmiralSliceOptions,
  BenchGameSlice,
} from './bench-fleet-admiral.js';
export {
  benchFleetAdmiralSlice,
  benchFleetAdmiralVsCommander,
  resolveFleetBenchOptions,
} from './bench-fleet-admiral.js';

export type { FleetAdmiralSearchProfile } from './fleet-admiral.js';
export {
  fleetAdmiralProfile,
  resolveClass1StarPlayLookahead,
  resolveDeepThinkAdvisorLookahead,
  resolveFleetAdmiralExpectimaxLookahead,
  resolveFleetAdmiralIsmctsLookahead,
  resolveFleetAdmiralLookahead,
  resolveFleetAdmiralPlayLookahead,
  type FleetAdmiralPlayMode,
} from './fleet-admiral.js';

export { ismctsSearchActionValues } from './ismcts.js';
export type { IsmctsOptions, ScoredIsmctsAction } from './ismcts.js';

export { searchActionValuesWithBudget } from './time-budget-search.js';
export {
  assignHiddenHands,
  passesBeliefConstraints,
} from './belief-constraints.js';
export type { WarpSearchModelOptions } from './search-model.js';

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

export { chooseQFlashEffect, chooseQGambleKeepIndex } from './flash.js';

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
  CalibrationRunOptions,
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

