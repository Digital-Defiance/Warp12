import { getLegalMoves } from '../engine/legal-moves.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
} from '../engine/beacon.js';
import { ADVISOR_STATE_CONCEPT_DIM } from './advisor-constants.js';
import type { WarpEvalContext } from './context.js';
import { minOpponentHandSize } from './go-out-race.js';
import { handPips } from './search-model.js';

/** Stable concept ids — order matches {@link computeAdvisorStateConcepts}. */
export const ADVISOR_CONCEPT_IDS = [
  'points-objective',
  'go-out-objective',
  'table-size',
  'hand-size',
  'pile-depth',
  'spacedock-value',
  'opponent-hand-min',
  'opponent-hand-max',
  'race-build',
  'race-sprint',
  'race-defensive',
  'chart-available',
  'draw-pressure',
  'beacon-option',
  'red-alert-pressure',
  'own-trail-open',
  'neutral-zone-open',
  'hand-pip-burden',
  'turn-position',
  'fracture-active',
] as const;

export type AdvisorConceptId = (typeof ADVISOR_CONCEPT_IDS)[number];

const CONCEPT_LABELS: Readonly<Record<AdvisorConceptId, string>> = {
  'points-objective': 'Points campaign — minimize cumulative pips.',
  'go-out-objective': 'Go-out race — empty your hand first.',
  'table-size': 'Larger fleets spread scoring pressure.',
  'hand-size': 'Hand size shapes tempo and risk.',
  'pile-depth': 'Uncharted pile depth affects draw odds.',
  'spacedock-value': 'Spacedock double sets the round engine.',
  'opponent-hand-min': 'Rivals are holding short hands.',
  'opponent-hand-max': 'At least one rival still holds a long hand.',
  'race-build': 'Build phase — grow your warp trail.',
  'race-sprint': 'Sprint phase — push to go out.',
  'race-defensive': 'Defensive phase — slow the leader.',
  'chart-available': 'A legal chart is available.',
  'draw-pressure': 'Drawing may be necessary soon.',
  'beacon-option': 'Distress beacon is an option.',
  'red-alert-pressure': 'Red Alert doubles constrain routes.',
  'own-trail-open': 'Your warp trail is open.',
  'neutral-zone-open': 'Neutral Zone accepts charts.',
  'hand-pip-burden': 'High pip weight in hand (points).',
  'turn-position': 'Seat order affects round pressure.',
  'fracture-active': 'Subspace fracture is on the table.',
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function redAlertDoubleCount(ctx: WarpEvalContext): number {
  return ctx.obs.round.table.redAlert?.active ? 1 : 0;
}

/**
 * Deterministic state concepts in [0, 1] — supervised during training and used
 * for bottleneck explanations at inference.
 */
export function computeAdvisorStateConcepts(
  ctx: WarpEvalContext,
  out: Float32Array = new Float32Array(ADVISOR_STATE_CONCEPT_DIM)
): Float32Array {
  if (out.length !== ADVISOR_STATE_CONCEPT_DIM) {
    throw new Error(
      `Advisor concept buffer length ${out.length} != ${ADVISOR_STATE_CONCEPT_DIM}.`
    );
  }
  out.fill(0);
  const { obs, hand, goOutRacePhase } = ctx;
  const round = obs.round;
  const playerCount = Math.max(1, obs.captains.length);
  const handSize = hand.length;
  const pile = round.unchartedSectors.length;
  const minOpp = minOpponentHandSize(obs, obs.playerId, handSize);
  let maxOpp = 0;
  for (const captain of obs.captains) {
    if (captain.id === obs.playerId) continue;
    maxOpp = Math.max(maxOpp, (round.hands[captain.id] ?? []).length);
  }

  let i = 0;
  out[i++] = obs.objective === 'points' ? 1 : 0;
  out[i++] = obs.objective === 'go-out' ? 1 : 0;
  out[i++] = clamp01((playerCount - 2) / 6);
  out[i++] = clamp01(handSize / 13);
  out[i++] = clamp01(pile / 91);
  out[i++] = clamp01(round.spacedockValue / 12);
  out[i++] = clamp01(minOpp / 13);
  out[i++] = clamp01(maxOpp / 13);

  if (obs.objective === 'go-out') {
    out[i + (goOutRacePhase === 'build' ? 0 : goOutRacePhase === 'sprint' ? 1 : 2)] =
      1;
  }
  i += 3;

  const legalCharts = getLegalMoves(round, obs.playerId, obs.houseRules);
  out[i++] = legalCharts.length > 0 ? 1 : 0;
  out[i++] =
    pile <= 8 && legalCharts.length === 0 && canDrawFromUncharted(round, obs.playerId, obs.houseRules)
      ? 1
      : 0;
  out[i++] = canDeployDistressBeacon(round, obs.playerId, {
    houseRules: obs.houseRules,
  })
    ? 1
    : 0;
  out[i++] = clamp01(redAlertDoubleCount(ctx) / 4);

  const ownTrail = round.table.warpTrails[obs.playerId];
  out[i++] = ownTrail && ownTrail.tiles.length > 0 ? 1 : 0;
  out[i++] = round.table.neutralZone.tiles.length > 0 ? 1 : 0;

  const pipSum = handPips(hand, obs.modules, round.roundNumber);
  out[i++] = clamp01(pipSum / (13 * 12));

  const activeIndex = round.turnOrder.indexOf(obs.playerId);
  out[i++] =
    activeIndex >= 0 ? clamp01(activeIndex / Math.max(1, playerCount - 1)) : 0;
  out[i++] = round.table.subspaceFracture ? 1 : 0;

  if (i !== ADVISOR_STATE_CONCEPT_DIM) {
    throw new Error(
      `Advisor concept encoder drift: wrote ${i}, expected ${ADVISOR_STATE_CONCEPT_DIM}.`
    );
  }
  return out;
}

export function advisorConceptLabel(id: AdvisorConceptId): string {
  return CONCEPT_LABELS[id];
}

/** Rank active concepts for explanations (highest scalar first). */
export function rankAdvisorConcepts(
  concepts: ReadonlyArray<number> | Float32Array,
  options?: { minStrength?: number; maxReasons?: number }
): { id: AdvisorConceptId; strength: number; label: string }[] {
  const minStrength = options?.minStrength ?? 0.35;
  const maxReasons = options?.maxReasons ?? 3;
  const ranked = ADVISOR_CONCEPT_IDS.map((id, index) => ({
    id,
    strength: concepts[index] ?? 0,
    label: CONCEPT_LABELS[id],
  }))
    .filter((entry) => entry.strength >= minStrength)
    .sort((a, b) => b.strength - a.strength);
  return ranked.slice(0, maxReasons);
}

export function explainAdvisorConcepts(
  concepts: ReadonlyArray<number> | Float32Array,
  options?: { maxReasons?: number }
): string[] {
  return rankAdvisorConcepts(concepts, options).map((entry) => entry.label);
}
