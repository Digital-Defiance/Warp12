import {
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
  mustDrawBeforePassing,
} from '../engine/beacon.js';
import { getLegalMoves } from '../engine/legal-moves.js';
import {
  isRedAlertBlocking,
} from '../types/anomalies.js';
import type { GameState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import type { WarpAiAction } from './actions.js';

function redAlertTargetLabel(
  state: GameState,
  playerId: PlayerId,
  names?: Readonly<Record<string, string>>
): string {
  const redAlert = state.round?.table.redAlert;
  if (!redAlert?.active) {
    return 'the uncovered double';
  }
  const { low, high } = redAlert.anchor.coordinate;
  const tile = `${low}:${high}`;
  if (redAlert.neutralZone) {
    return `${tile} on the Neutral Zone`;
  }
  if (redAlert.trailPlayerId === playerId) {
    return `${tile} on your warp trail`;
  }
  const owner = names?.[redAlert.trailPlayerId] ?? 'another captain';
  return `${tile} on ${owner}'s warp trail`;
}

/** Rule-aware explanations for draw, pass, beacon, and Red Alert resolution. */
export function explainTurnResolution(
  state: GameState,
  playerId: PlayerId,
  options?: {
    names?: Readonly<Record<string, string>>;
    focus?: WarpAiAction['kind'];
  }
): string[] {
  const round = state.round;
  if (!round || round.activePlayerId !== playerId) {
    return [];
  }

  const lines: string[] = [];
  const legalMoves = getLegalMoves(round, playerId);
  const uncharted = round.unchartedSectors.length;
  const mustDraw = mustDrawBeforePassing(round, playerId);
  const redAlertBlocking = isRedAlertBlocking(round.table.redAlert, playerId);
  const beaconActive =
    round.table.warpTrails[playerId]?.distressBeacon.active === true;
  const fractureBlocks =
    round.table.subspaceFracture?.active === true &&
    legalMoves.some((move) => move.route.kind === 'fracture-stabilizer');

  if (fractureBlocks) {
    lines.push(
      'Subspace Fracture is active — chart a stabilizer on the fracture before drawing or passing.'
    );
    return lines;
  }

  if (round.qPendingInvoker === playerId) {
    lines.push('Resolve your Q-Flash choice before other actions.');
    return lines;
  }

  if (round.qGamblePending?.playerId === playerId) {
    lines.push("Resolve Q's gamble before other actions.");
    return lines;
  }

  if (legalMoves.length > 0) {
    return lines;
  }

  if (mustDraw) {
    lines.push(
      `Nothing in your hand plays — you must draw from Uncharted Sectors (${uncharted} tile${uncharted === 1 ? '' : 's'} left). Pass and shields-down options only apply after you draw, or when the pile is empty.`
    );
    if (redAlertBlocking) {
      lines.push(
        `Red Alert is on you to cover ${redAlertTargetLabel(state, playerId, options?.names)} — try the draw first; you can pass only if you still cannot cover afterward.`
      );
    }
    return lines;
  }

  if (redAlertBlocking) {
    const target = redAlertTargetLabel(state, playerId, options?.names);
    if (canPassRedAlert(round, playerId)) {
      lines.push(
        `Pass Red Alert is legal — nothing in your hand covers ${target}, and you have already drawn or Uncharted Sectors is empty.`
      );
      lines.push(
        'Passing deploys your Distress Beacon and moves Red Alert responsibility to the next captain — the double stays until someone covers it.'
      );
    } else {
      lines.push(
        `Red Alert is on you — cover ${target} if you can, or pass once no tile in your hand fits.`
      );
    }
  }

  if (canPassTurn(round, playerId)) {
    lines.push(
      'Pass is legal — your shields are already down, you have no chart, and Red Alert is not blocking you. The turn ends without drawing.'
    );
  }

  if (canDeployDistressBeacon(round, playerId)) {
    lines.push(
      'Shields down is required — no legal chart and Uncharted Sectors is empty. Your warp trail opens to all captains.'
    );
  }

  if (
    lines.length === 0 &&
    uncharted === 0 &&
    !beaconActive &&
    !redAlertBlocking
  ) {
    lines.push(
      'No legal chart and the draw pile is empty — deploy Distress Beacon or pass if your trail is already open.'
    );
  }

  if (options?.focus) {
    return prioritizeFocus(lines, options.focus);
  }

  return lines;
}

function prioritizeFocus(
  lines: string[],
  focus: WarpAiAction['kind']
): string[] {
  const keywords: Partial<Record<WarpAiAction['kind'], RegExp>> = {
    draw: /draw from Uncharted/i,
    'pass-red-alert': /Pass Red Alert/i,
    'pass-turn': /^Pass is legal/i,
    'deploy-beacon': /Shields down/i,
  };
  const pattern = keywords[focus];
  if (!pattern) {
    return lines;
  }
  const match = lines.find((line) => pattern.test(line));
  if (!match) {
    return lines;
  }
  return [match, ...lines.filter((line) => line !== match)];
}
