import {
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsManually,
  mustDrawBeforePassing,
} from '../engine/beacon.js';
import { getLegalMoves } from '../engine/legal-moves.js';
import {
  isNavigationHaltedByFracture,
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
  const houseRules = state.houseRules;
  const legalMoves = getLegalMoves(round, playerId, houseRules);
  const uncharted = round.unchartedSectors.length;
  const mustDraw = mustDrawBeforePassing(round, playerId, houseRules);
  const redAlertBlocking = isRedAlertBlocking(round.table.redAlert, playerId);
  // The free pass (no draw, no beacon) applies only to the captain who charted
  // the double, while the alert is still in the Caution phase (not yet passed).
  const freePass =
    houseRules.passRedAlertWithoutDraw &&
    round.table.redAlert?.passed !== true;
  const beaconActive =
    round.table.warpTrails[playerId]?.distressBeacon.active === true;
  const fractureActive = isNavigationHaltedByFracture(
    round.table.subspaceFracture,
    round.table.redAlert
  );
  const canStabilize = legalMoves.some(
    (move) => move.route.kind === 'fracture-stabilizer'
  );

  if (fractureActive) {
    if (canStabilize) {
      lines.push(
        'Subspace Fracture is active — chart a stabilizer on the fracture double. The third stabilizer clears the fracture and Red Alert.'
      );
      return lines;
    }

    if (mustDraw) {
      lines.push(
        `Subspace Fracture is active — no stabilizer in your hand. Draw from Uncharted Sectors (${uncharted} tile${uncharted === 1 ? '' : 's'} left).`
      );
      if (redAlertBlocking) {
        lines.push(
          'If you still cannot stabilize after drawing, you may pass Red Alert. Stabilizers satisfy the double — a separate cover tile is not used.'
        );
      }
      return lines;
    }

    if (redAlertBlocking && canPassRedAlert(round, playerId, { houseRules })) {
      lines.push(
        freePass
          ? 'Pass Red Alert — you cannot add a stabilizer. Responsibility passes to the next captain and your shields stay up.'
          : 'Pass Red Alert — you cannot add a stabilizer. Your Distress Beacon deploys and responsibility passes to the next captain.'
      );
      lines.push(
        'The next responsible captain must continue stabilizing until three branches are placed; the third clears both Subspace Fracture and Red Alert.'
      );
      return options?.focus
        ? prioritizeFocus(lines, options.focus)
        : lines;
    }

    if (redAlertBlocking) {
      lines.push(
        'Subspace Fracture is active — stabilize the double or pass Red Alert once you cannot add a stabilizer.'
      );
      return lines;
    }
  }

  if (round.qPendingInvoker === playerId) {
    lines.push('Resolve your Q-Flash choice before other actions.');
    return lines;
  }

  if (round.qGamblePending?.playerId === playerId) {
    lines.push("Resolve Q's gamble before other actions.");
    return lines;
  }

  if (
    houseRules?.dropToImpulseCall &&
    round.dropToImpulseCallPending === playerId &&
    (round.hands[playerId]?.length ?? 0) === 1
  ) {
    lines.push(
      'At impulse (one tile left) — announce Drop to Impulse! and pass helm, or pass without announcing (opponents may catch until the next captain passes helm). You cannot chart while at impulse; play your last coordinate on a later turn after announcing, or draw from Uncharted Sectors to return to warp.'
    );
    return lines;
  }

  if (legalMoves.length > 0) {
    if (houseRules.manualShieldControl) {
      const beaconActive =
        round.table.warpTrails[playerId]?.distressBeacon.active === true;
      if (
        !beaconActive &&
        canDeployDistressBeacon(round, playerId, { houseRules })
      ) {
        lines.push(
          'Shields down is legal — open your warp trail voluntarily after you have started your own trail. Charting on your own trail will not raise shields automatically.'
        );
      }
      if (canRaiseShieldsManually(round, playerId, houseRules)) {
        lines.push(
          'Shields up is legal — close your warp trail until you drop shields again. You may do this before you pass helm.'
        );
      }
    }
    if (round.playedThisTurn) {
      lines.push(
        'Pass is legal — end your turn after any optional shield change.'
      );
    }
    return lines;
  }

  if (mustDraw && !(redAlertBlocking && canPassRedAlert(round, playerId, { houseRules }))) {
    lines.push(
      houseRules.manualShieldControl
        ? `Nothing in your hand plays — you must draw from Uncharted Sectors (${uncharted} tile${uncharted === 1 ? '' : 's'} left). If you still cannot chart afterward, shields down is required.`
        : `Nothing in your hand plays — you must draw from Uncharted Sectors (${uncharted} tile${uncharted === 1 ? '' : 's'} left). Pass and shields-down options only apply after you draw, or when the pile is empty.`
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
    if (canPassRedAlert(round, playerId, { houseRules })) {
      lines.push(
        freePass
          ? `Pass Red Alert is legal — nothing in your hand covers ${target}. You charted this double, so this table lets you pass without drawing and without deploying your Distress Beacon.`
          : uncharted > 0
            ? `Pass Red Alert is legal — nothing in your hand covers ${target}, and you have already drawn or Uncharted Sectors is empty.`
            : `Pass Red Alert is legal — nothing in your hand covers ${target}, and Uncharted Sectors is empty.`
      );
      if (!freePass) {
        lines.push(
          'Passing deploys your Distress Beacon and moves Red Alert responsibility to the next captain — the double stays unsatisfied until someone covers it or completes three stabilizers on a Subspace Fracture.'
        );
      } else {
        lines.push(
          'Responsibility moves to the next captain — the double stays unsatisfied until someone covers it or completes three stabilizers on a Subspace Fracture.'
        );
      }
    } else {
      lines.push(
        `Red Alert is on you — cover ${target} if you can, or pass once no tile in your hand fits.`
      );
    }
  }

  if (canPassTurn(round, playerId, { houseRules })) {
    lines.push(
      'Pass is legal — your shields are already down, you have no chart, and Red Alert is not blocking you. The turn ends without drawing.'
    );
  }

  if (canDeployDistressBeacon(round, playerId, { houseRules })) {
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
    'drop-to-impulse': /At impulse|Drop to Impulse/i,
    'catch-drop-to-impulse': /catch/i,
    'raise-shields': /Shields up/i,
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
