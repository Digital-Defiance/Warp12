/**
 * Go-out sector structure — sudden death (default) or a multi-round campaign
 * that descends Spacedock like a points campaign and tallies round wins.
 */

/** How a go-out sector decides the victor. */
export type GoOutStructure = 'sudden-death' | 'fixed-rounds' | 'first-to';

/**
 * When a fixed-rounds go-out campaign ends with a win-count tie:
 * - force: immediately deal overtime rounds (Spacedock wraps past 0-0)
 * - offer: pause for host accept/decline before overtime
 */
export type GoOutOvertimePolicy = 'force' | 'offer';

export const DEFAULT_GO_OUT_STRUCTURE: GoOutStructure = 'sudden-death';
export const DEFAULT_GO_OUT_OVERTIME: GoOutOvertimePolicy = 'force';
export const DEFAULT_GO_OUT_WINS_TO_WIN = 3;
export const MIN_GO_OUT_WINS_TO_WIN = 1;
export const MAX_GO_OUT_WINS_TO_WIN = 13;

export const GO_OUT_STRUCTURE_LABELS: Record<GoOutStructure, string> = {
  'sudden-death': 'Sudden death — first empty hand wins the sector',
  'fixed-rounds': 'Fixed rounds — most round wins after Spacedock descent',
  'first-to': 'First to X — first captain to win X rounds takes the sector',
};

export const GO_OUT_OVERTIME_LABELS: Record<GoOutOvertimePolicy, string> = {
  force: 'Force overtime until the tie breaks',
  offer: 'Offer overtime (host accepts or ends tied)',
};

export function resolveGoOutStructure(
  value: GoOutStructure | undefined
): GoOutStructure {
  if (
    value === 'sudden-death' ||
    value === 'fixed-rounds' ||
    value === 'first-to'
  ) {
    return value;
  }
  return DEFAULT_GO_OUT_STRUCTURE;
}

export function resolveGoOutOvertime(
  value: GoOutOvertimePolicy | undefined
): GoOutOvertimePolicy {
  return value === 'offer' ? 'offer' : DEFAULT_GO_OUT_OVERTIME;
}

export function clampGoOutWinsToWin(wins: number): number {
  return Math.min(
    MAX_GO_OUT_WINS_TO_WIN,
    Math.max(MIN_GO_OUT_WINS_TO_WIN, Math.round(wins))
  );
}
