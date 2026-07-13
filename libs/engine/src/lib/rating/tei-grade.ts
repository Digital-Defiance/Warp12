/**
 * TEI Grade System — Gamified presentation layer over OpenSkill ratings.
 * 
 * Format: "E97" where:
 * - Letter (E/V/C/I/P) = Confidence grade based on σ (uncertainty)
 * - Number (0-99) = Normalized skill score based on μ - 3σ (conservative estimate)
 * 
 * This creates progression tension: players grind both the number AND the letter.
 * New modules spike σ → temporary grade drop → visible feedback loop.
 */

import type { PlayerRating } from './types.js';

/**
 * TEI Confidence Grades based on σ (uncertainty).
 * Lower σ = more data = higher confidence = better letter grade.
 */
export type TeiGrade = 'E' | 'V' | 'C' | 'I' | 'P';

/**
 * TEI display format: "E97" (grade + score)
 */
export interface TeiDisplay {
  readonly grade: TeiGrade;
  readonly score: number; // 0-99
  readonly formatted: string; // "E97"
}

/**
 * Configuration for TEI score normalization.
 * Define the μ range of your player population.
 */
export interface TeiScoreConfig {
  /** Minimum expected μ value (e.g., beginner floor) */
  readonly minMu: number;
  /** Maximum expected μ value (e.g., elite ceiling) */
  readonly maxMu: number;
  /** Conservative skill multiplier (default: 3 for μ - 3σ) */
  readonly conservativeK: number;
}

/**
 * Default TEI score config based on calibrated anchors.
 * - Min: Ensign μ = 18, with -3σ buffer → ~10
 * - Max: Hypothetical elite μ = 50 (well above Commander's 35)
 */
export const DEFAULT_TEI_CONFIG: TeiScoreConfig = {
  minMu: 10.0,
  maxMu: 50.0,
  conservativeK: 3.0,
};

/**
 * Grade boundaries with UNIDIRECTIONAL hysteresis.
 * 
 * Promotions (lower σ) happen immediately at threshold.
 * Demotions (higher σ) require sustained increase (hysteresis buffer).
 * 
 * Each grade has:
 * - `immediate`: σ threshold for immediate promotion (lower σ = better grade)
 * - `exit`: σ threshold to demote (higher σ = worse grade, with hysteresis)
 * 
 * Example: V grade (Veteran)
 * - Promote from C to V: immediately when σ < 1.5 (immediate threshold)
 * - Demote from V to C: only when σ > 1.7 (exit threshold, sustained increase)
 */
const GRADE_BOUNDARIES = {
  E: { immediate: 0.5, exit: 0.7 },     // Promote at σ < 0.5, demote at σ > 0.7
  V: { immediate: 1.5, exit: 1.7 },     // Promote at σ < 1.5, demote at σ > 1.7
  C: { immediate: 2.5, exit: 2.7 },     // Promote at σ < 2.5, demote at σ > 2.7
  I: { immediate: 4.0, exit: 4.5 },     // Promote at σ < 4.0, demote at σ > 4.5
  P: { immediate: Infinity, exit: Infinity }, // P has no upper bound (worst grade)
} as const;

/**
 * Grade order for comparison (lower index = better grade = lower σ)
 */
const GRADE_ORDER: readonly TeiGrade[] = ['E', 'V', 'C', 'I', 'P'] as const;

/** Accept letter or legacy formatted strings like `V67` for hysteresis. */
function coerceTeiGrade(value: TeiGrade | string | undefined): TeiGrade | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    value === 'E' ||
    value === 'V' ||
    value === 'C' ||
    value === 'I' ||
    value === 'P'
  ) {
    return value;
  }
  const letter = value.charAt(0).toUpperCase();
  if (
    letter === 'E' ||
    letter === 'V' ||
    letter === 'C' ||
    letter === 'I' ||
    letter === 'P'
  ) {
    return letter;
  }
  return undefined;
}

/**
 * Get raw grade from σ using immediate thresholds (for new players or promotions).
 * Uses immediate thresholds: 0.5, 1.5, 2.5, 4.0
 * 
 * @param sigma - OpenSkill uncertainty (σ)
 * @returns TEI confidence grade letter (immediate, no hysteresis)
 */
function getImmediateGrade(sigma: number): TeiGrade {
  // Promotions use immediate thresholds (no delay)
  // Use < comparisons so exact boundaries go to BETTER grade
  if (sigma < 0.5) return 'E'; // Elite
  if (sigma < 1.5) return 'V'; // Veteran  
  if (sigma < 2.5) return 'C'; // Consistent
  if (sigma < 4.0) return 'I'; // Improving
  return 'P'; // Provisional
}

/**
 * Map σ (uncertainty) to TEI confidence grade with UNIDIRECTIONAL hysteresis.
 * 
 * **Unidirectional hysteresis** means:
 * - **Promotions (lower σ)** happen immediately when σ crosses threshold
 * - **Demotions (higher σ)** require sustained increase before downgrade
 * 
 * This creates asymmetric behavior that rewards skill improvement and
 * prevents temporary variance from immediately dropping grades.
 * 
 * Example: Player at V (Veteran) with σ = 1.3
 * - If σ drops to 0.4 → immediately promote to E (no delay)
 * - If σ rises to 1.6 → stay at V (not enough to demote yet)
 * - If σ rises to 1.8 → demote to C (sustained increase crosses exit threshold)
 * 
 * Grades represent data confidence:
 * - E (Elite): Promote at σ < 0.5, demote at σ > 0.7 — Massive sample, anchored rating
 * - V (Veteran): Promote at σ < 1.5, demote at σ > 1.7 — Highly reliable estimate
 * - C (Consistent): Promote at σ < 2.5, demote at σ > 2.7 — Reliable with room to drift
 * - I (Improving): Promote at σ < 4.0, demote at σ > 4.5 — Recent changes or low sample
 * - P (Provisional): σ ≥ 4.0 — Insufficient data
 * 
 * @param sigma - OpenSkill uncertainty (σ)
 * @param currentGrade - Current displayed grade (for hysteresis on demotions), undefined for new players
 * @returns TEI confidence grade letter
 */
export function getTeiGrade(sigma: number, currentGrade?: TeiGrade | string): TeiGrade {
  const normalizedGrade = coerceTeiGrade(currentGrade);
  // New player or no history: use immediate grade (no hysteresis needed)
  if (normalizedGrade === undefined) {
    return getImmediateGrade(sigma);
  }

  // Check for immediate promotions (σ decreased enough to upgrade)
  // Scan from best to worst, stop at first grade we qualify for
  const immediateGrade = getImmediateGrade(sigma);
  const currentIndex = GRADE_ORDER.indexOf(normalizedGrade);
  const immediateIndex = GRADE_ORDER.indexOf(immediateGrade);
  
  // If immediate grade is better (lower index), promote immediately
  if (immediateIndex < currentIndex) {
    return immediateGrade; // Instant promotion!
  }
  
  // Check for demotion (σ increased enough to downgrade)
  // Only demote if we exceed the EXIT threshold
  const currentBoundary = GRADE_BOUNDARIES[normalizedGrade];
  
  if (sigma > currentBoundary.exit) {
    // We've exceeded exit threshold, need to demote
    // Find the appropriate lower grade
    return getImmediateGrade(sigma);
  }
  
  // σ is between immediate threshold and exit threshold - stay at current grade
  return normalizedGrade;
}

/**
 * Get full grade name for display.
 */
export function getTeiGradeName(grade: TeiGrade): string {
  switch (grade) {
    case 'E': return 'Elite';
    case 'V': return 'Veteran';
    case 'C': return 'Consistent';
    case 'I': return 'Improving';
    case 'P': return 'Provisional';
  }
}

/**
 * Get grade description for tooltips.
 */
export function getTeiGradeDescription(grade: TeiGrade): string {
  switch (grade) {
    case 'E': return 'Anchored rating with massive sample size';
    case 'V': return 'Highly reliable skill estimate';
    case 'C': return 'Reliable estimate with room for drift';
    case 'I': return 'Recent changes or lower sample size';
    case 'P': return 'Insufficient data, still establishing rating';
  }
}

/**
 * Calculate TEI score (0-99) from conservative skill estimate.
 * 
 * Uses μ - kσ (default k=3) to prevent "new player inflation."
 * Normalizes into 0-99 range based on expected population μ range.
 * 
 * @param rating - OpenSkill rating (μ, σ)
 * @param config - Score normalization config
 * @returns Integer score 0-99
 */
export function getTeiScore(
  rating: PlayerRating,
  config: TeiScoreConfig = DEFAULT_TEI_CONFIG
): number {
  // Conservative skill estimate: μ - kσ
  const conservativeEstimate = rating.mu - config.conservativeK * rating.sigma;

  // Normalize to 0-99 range
  const normalized =
    ((conservativeEstimate - config.minMu) / (config.maxMu - config.minMu)) * 99;

  // Clamp to [0, 99] and round
  return Math.max(0, Math.min(99, Math.round(normalized)));
}

/**
 * Calculate complete TEI display (grade + score) with hysteresis support.
 * 
 * @param rating - OpenSkill rating
 * @param currentGrade - Current displayed grade (for hysteresis), undefined for new players
 * @param config - Score normalization config (optional)
 * @returns TEI display object with grade, score, and formatted string
 * 
 * @example
 * ```typescript
 * const rating = { mu: 32.0, sigma: 1.2, matches: 150 };
 * const tei = getTeiDisplay(rating, 'V'); // Pass current grade for hysteresis
 * // { grade: 'V', score: 67, formatted: 'V67' }
 * ```
 */
export function getTeiDisplay(
  rating: PlayerRating,
  currentGrade?: TeiGrade | string,
  config?: TeiScoreConfig
): TeiDisplay {
  const grade = getTeiGrade(rating.sigma, currentGrade);
  const score = getTeiScore(rating, config);
  return {
    grade,
    score,
    formatted: `${grade}${score}`,
  };
}

/**
 * Check if a rating is provisional (P grade).
 * Provisional ratings should show uncertainty warnings.
 */
export function isTeiProvisional(rating: PlayerRating): boolean {
  return rating.sigma >= 4.0;
}

/**
 * Get TEI grade color for UI theming.
 * 
 * @param grade - TEI confidence grade
 * @returns CSS color class suffix (e.g., 'elite', 'veteran')
 */
export function getTeiGradeColor(grade: TeiGrade): string {
  switch (grade) {
    case 'E': return 'elite'; // Gold/yellow
    case 'V': return 'veteran'; // Blue
    case 'C': return 'consistent'; // Green
    case 'I': return 'improving'; // Orange
    case 'P': return 'provisional'; // Gray
  }
}

/**
 * Calculate expected TEI change for simulation/preview with hysteresis.
 * Shows what a win/loss would do to the TEI grade.
 * 
 * Note: This is approximate. Actual OpenSkill updates depend on
 * opponent ratings and ranks.
 */
export function previewTeiChange(
  currentRating: PlayerRating,
  currentGrade: TeiGrade | undefined,
  won: boolean,
  config?: TeiScoreConfig
): {
  currentTei: TeiDisplay;
  estimatedTei: TeiDisplay;
  scoreDelta: number;
  gradeChange: boolean;
} {
  const currentTei = getTeiDisplay(currentRating, currentGrade, config);

  // Rough estimate: σ decreases by ~5-10%, μ shifts by ~1-3 points
  const estimatedSigma = currentRating.sigma * 0.95;
  const estimatedMu = currentRating.mu + (won ? 2.0 : -2.0);

  const estimatedRating: PlayerRating = {
    mu: estimatedMu,
    sigma: estimatedSigma,
    matches: currentRating.matches + 1,
  };

  const estimatedTei = getTeiDisplay(estimatedRating, currentTei.grade, config);

  return {
    currentTei,
    estimatedTei,
    scoreDelta: estimatedTei.score - currentTei.score,
    gradeChange: estimatedTei.grade !== currentTei.grade,
  };
}
