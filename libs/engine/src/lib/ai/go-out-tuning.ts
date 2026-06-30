/** Tunable go-out phase thresholds — override per skill tier via {@link WarpSkillProfile}. */
export interface GoOutTuning {
  /** Hand size at or below which endgame sprint bonuses apply. */
  sprintHandSize: number;
  /** Own-trail tiles required before dump phase at 4+ players. */
  trailBuildTarget4p: number;
  /** Own-trail tiles required before dump phase at 2–3 players. */
  trailBuildTargetSmall: number;
  /** Extra penalty for doubles on shared routes (added to base mayhem). */
  mayhemDoublePenalty: number;
  /** Block when any opponent has this many tiles or fewer. */
  blockLeaderHandSize: number;
  /** Penalize drawing when hand is this small or smaller. */
  drawReluctanceHandSize: number;
}

export const DEFAULT_GO_OUT_TUNING: GoOutTuning = {
  sprintHandSize: 5,
  trailBuildTarget4p: 1,
  trailBuildTargetSmall: 3,
  mayhemDoublePenalty: 35,
  blockLeaderHandSize: 2,
  drawReluctanceHandSize: 4,
};

export function resolveGoOutTuning(
  partial?: Partial<GoOutTuning>
): GoOutTuning {
  return { ...DEFAULT_GO_OUT_TUNING, ...partial };
}
