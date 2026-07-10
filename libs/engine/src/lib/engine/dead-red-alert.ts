import type { RoundState, TableState } from '../types/game-state.js';
import { isRedAlertDoubleDead } from '../table/pip-inventory.js';
import { archiveFractureStabilizers } from '../table/fracture-stabilizers.js';

/** Clear Red Alert when the double pip is exhausted (dead double). */
export function resolveDeadRedAlert(
  round: RoundState,
  maxPip?: number
): RoundState {
  if (!isRedAlertDoubleDead(round, maxPip)) {
    return round;
  }
  const redAlert = round.table.redAlert!;
  const fracture = round.table.subspaceFracture;
  const clearFracture =
    fracture?.active === true &&
    fracture.anchor.index === redAlert.anchor.index &&
    fracture.anchor.coordinate.low === redAlert.anchor.coordinate.low &&
    fracture.anchor.coordinate.high === redAlert.anchor.coordinate.high;

  let table: TableState = { ...round.table, redAlert: null };
  if (clearFracture && fracture) {
    table = archiveFractureStabilizers(table, fracture);
    table = { ...table, subspaceFracture: null };
  }

  return {
    ...round,
    table,
  };
}
