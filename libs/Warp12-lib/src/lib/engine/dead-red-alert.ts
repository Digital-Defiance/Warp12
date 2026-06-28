import type { RoundState } from '../types/game-state.js';
import { isRedAlertDoubleDead } from '../table/pip-inventory.js';

/** Clear Red Alert when the double pip is exhausted (Mexican Train dead double). */
export function resolveDeadRedAlert(round: RoundState): RoundState {
  if (!isRedAlertDoubleDead(round)) {
    return round;
  }
  return {
    ...round,
    table: { ...round.table, redAlert: null },
  };
}
