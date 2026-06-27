import {
  isDouble,
  type Coordinate,
  type PlacedCoordinate,
} from '../types/coordinate.js';
import type { GameAction, ActionResult, ChartRoute } from '../types/actions.js';
import type { GameState, RoundState, TableState } from '../types/game-state.js';
import type { QFlash } from '../types/modules.js';
import type { QFlashEffectKind } from '../types/q-continuum.js';
import type { WarpTrail } from '../types/trails.js';
import {
  handContains,
  removeCoordinateFromHand,
} from '../domino/coordinates.js';
import {
  isNavigationHaltedByFracture,
  isRedAlertBlocking,
  type RedAlert,
  type SubspaceFracture,
} from '../types/anomalies.js';
import {
  neutralZoneOpenValue,
  trailOpenValue,
} from '../table/table-state.js';
import {
  fail,
  requireActiveRound,
  requirePlayerTurn,
  withRound,
} from './helpers.js';
import {
  advanceActivePlayer,
  applyQFlashEffect,
  buildQFlashEffect,
  clearTemporalInversionOnDouble,
  consumeFractureImmunity,
  nextActivePlayerId,
  resolveQGamble,
  trailsOpenToOthers,
  treatyRequiredForWin,
} from './q-continuum.js';
import { getLegalMoves, isLegalMove, placedTile } from './legal-moves.js';
import {
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
} from './beacon.js';
import { scoreRound } from './scoring.js';

function appendToTrail(
  trail: WarpTrail,
  tile: PlacedCoordinate
): WarpTrail {
  return {
    ...trail,
    tiles: [...trail.tiles, tile],
  };
}

function clearDistressBeacon(trail: WarpTrail): WarpTrail {
  if (!trail.distressBeacon.active) {
    return trail;
  }
  return { ...trail, distressBeacon: { active: false } };
}

function updateHands(
  round: RoundState,
  playerId: string,
  hand: Coordinate[]
): RoundState {
  return {
    ...round,
    hands: { ...round.hands, [playerId]: hand },
  };
}

function updateTable(round: RoundState, table: TableState): RoundState {
  return { ...round, table };
}

function openSubspaceFracture(
  anchor: PlacedCoordinate,
  existing: SubspaceFracture | null
): SubspaceFracture {
  return {
    active: true,
    anchor,
    stabilizers: existing?.stabilizers ?? [],
    requiredValue: anchor.coordinate.low,
  };
}

function openRedAlert(
  anchor: PlacedCoordinate,
  responsiblePlayerId: string,
  trailPlayerId: string
): RedAlert {
  return {
    active: true,
    anchor,
    responsiblePlayerId,
    trailPlayerId,
  };
}

function resolvePostChartAnomalies(
  round: RoundState,
  playerId: string,
  placed: PlacedCoordinate,
  route: ChartRoute,
  wasCover: boolean,
  subspaceFractureEnabled: boolean
): RoundState {
  let table = round.table;
  let redAlert = table.redAlert;
  let nextRound = round;

  if (wasCover && redAlert?.active) {
    redAlert = null;
  }

  const playedDouble = isDouble(placed.coordinate);
  const onOwnTrail =
    route.kind === 'warp-trail' && route.playerId === playerId;

  if (playedDouble) {
    nextRound = clearTemporalInversionOnDouble(nextRound);
  }

  if (playedDouble && onOwnTrail && !wasCover) {
    redAlert = openRedAlert(placed, playerId, playerId);
    const { round: afterImmunity, consumed } = consumeFractureImmunity(nextRound);
    nextRound = afterImmunity;
    table = {
      ...table,
      redAlert,
      subspaceFracture:
        subspaceFractureEnabled && !consumed
          ? openSubspaceFracture(placed, table.subspaceFracture)
          : table.subspaceFracture,
    };
  } else {
    table = { ...table, redAlert };
  }

  return updateTable(nextRound, table);
}

function applyChartToRoute(
  round: RoundState,
  playerId: string,
  coordinate: Coordinate,
  route: ChartRoute,
  options: {
    subspaceFractureEnabled: boolean;
    qContinuumEnabled: boolean;
  }
): RoundState {
  const { hand, removed } = removeCoordinateFromHand(
    round.hands[playerId] ?? [],
    coordinate
  );
  if (!removed) {
    throw new Error('Coordinate not in hand');
  }

  let nextRound = updateHands(round, playerId, hand);
  let table = { ...nextRound.table };
  let placed: PlacedCoordinate;
  let wasCover = false;

  switch (route.kind) {
    case 'fracture-stabilizer': {
      const fracture = table.subspaceFracture!;
      placed = placedTile(
        removed,
        fracture.stabilizers.length,
        fracture.requiredValue
      )!;
      const stabilizers = [...fracture.stabilizers, placed];
      table = {
        ...table,
        subspaceFracture: {
          ...fracture,
          stabilizers,
          active: stabilizers.length < 3,
        },
      };
      break;
    }
    case 'red-alert-cover': {
      const trail = table.warpTrails[route.trailPlayerId];
      const connectingValue = trailOpenValue(trail, round.spacedockValue);
      const tile = placedTile(removed, trail.tiles.length, connectingValue)!;
      placed = tile;
      wasCover = true;
      table = {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          [route.trailPlayerId]: appendToTrail(
            clearDistressBeacon(trail),
            tile
          ),
        },
      };
      break;
    }
    case 'neutral-zone': {
      const connectingValue = neutralZoneOpenValue(
        table.neutralZone,
        round.spacedockValue
      );
      placed = placedTile(
        removed,
        table.neutralZone.tiles.length,
        connectingValue
      )!;
      table = {
        ...table,
        neutralZone: {
          tiles: [...table.neutralZone.tiles, placed],
        },
      };
      break;
    }
    case 'warp-trail': {
      const trail = table.warpTrails[route.playerId];
      const connectingValue = trailOpenValue(trail, round.spacedockValue);
      placed = placedTile(removed, trail.tiles.length, connectingValue)!;
      const updatedTrail =
        route.playerId === playerId
          ? appendToTrail(clearDistressBeacon(trail), placed)
          : appendToTrail(trail, placed);
      table = {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          [route.playerId]: updatedTrail,
        },
      };
      break;
    }
  }

  nextRound = resolvePostChartAnomalies(
    updateTable(nextRound, table),
    playerId,
    placed,
    route,
    wasCover,
    options.subspaceFractureEnabled
  );

  const playedZeroZero =
    options.qContinuumEnabled &&
    isDouble(placed.coordinate) &&
    placed.coordinate.low === 0;

  const winnerHand = nextRound.hands[playerId] ?? [];
  if (winnerHand.length === 0) {
    const treatyRequired = treatyRequiredForWin(nextRound, route.kind);
    return {
      ...nextRound,
      treatyDeclarationRequired: treatyRequired,
      treatyDeclared: !treatyRequired,
      roundWinnerId: playerId,
      phase: treatyRequired ? 'playing' : 'ended',
    };
  }

  if (playedZeroZero) {
    nextRound = { ...nextRound, qPendingInvoker: playerId };
  }

  if (nextRound.qPendingInvoker || nextRound.qGamblePending) {
    return nextRound;
  }

  if (
    isRedAlertBlocking(nextRound.table.redAlert, playerId) ||
    isNavigationHaltedByFracture(nextRound.table.subspaceFracture)
  ) {
    return nextRound;
  }

  return advanceTurn(nextRound);
}

function advanceTurn(round: RoundState): RoundState {
  if (round.treatyDeclarationRequired && !round.treatyDeclared) {
    return round;
  }

  if (round.qPendingInvoker || round.qGamblePending) {
    return round;
  }

  return advanceActivePlayer(round);
}

function handleDraw(
  state: GameState,
  round: RoundState,
  playerId: string
): ActionResult {
  if (round.unchartedSectors.length === 0) {
    return fail('EMPTY_UNCHARTED');
  }

  const [drawn, ...remaining] = round.unchartedSectors;
  let nextRound = updateHands(round, playerId, [
    ...(round.hands[playerId] ?? []),
    drawn,
  ]);
  nextRound = { ...nextRound, unchartedSectors: remaining };

  const legalWithDrawn = getLegalMoves(nextRound, playerId).filter(
    (move) =>
      move.coordinate.low === drawn.low &&
      move.coordinate.high === drawn.high
  );

  if (legalWithDrawn.length > 0) {
    return applyAction(withRound(state, nextRound), {
      type: 'CHART_COORDINATE',
      playerId,
      coordinate: drawn,
      route: legalWithDrawn[0].route,
    });
  }

  if (isRedAlertBlocking(nextRound.table.redAlert, playerId)) {
    if (canPassRedAlert(nextRound, playerId, { afterDraw: true })) {
      return handlePassRedAlert(state, nextRound, playerId, { afterDraw: true });
    }
  }

  if (canDeployDistressBeacon(nextRound, playerId, { afterDraw: true })) {
    return handleDeployBeacon(state, nextRound, playerId, { afterDraw: true });
  }

  if (canPassTurn(nextRound, playerId, { afterDraw: true })) {
    return handlePassTurn(state, nextRound, playerId, { afterDraw: true });
  }

  return { ok: true, state: withRound(state, advanceTurn(nextRound)) };
}

function handlePassRedAlert(
  state: GameState,
  round: RoundState,
  playerId: string,
  options?: { afterDraw?: boolean }
): ActionResult {
  if (!canPassRedAlert(round, playerId, options)) {
    const redAlert = round.table.redAlert;
    if (!redAlert?.active || redAlert.responsiblePlayerId !== playerId) {
      return fail('RED_ALERT_NOT_ACTIVE');
    }
    if (getLegalMoves(round, playerId).length > 0) {
      return fail('RED_ALERT_COVER_AVAILABLE');
    }
    if (round.unchartedSectors.length > 0) {
      return fail('MUST_DRAW_FIRST');
    }
    return fail('RED_ALERT_NOT_ACTIVE');
  }

  const redAlert = round.table.redAlert!;

  const nextResponsible = nextActivePlayerId(round, playerId);
  let nextRound = updateTable(round, {
    ...round.table,
    redAlert: {
      ...redAlert,
      responsiblePlayerId: nextResponsible,
    },
  });

  nextRound = {
    ...nextRound,
    table: {
      ...nextRound.table,
      warpTrails: {
        ...nextRound.table.warpTrails,
        [playerId]: {
          ...nextRound.table.warpTrails[playerId],
          distressBeacon: { active: true },
        },
      },
    },
  };

  nextRound = advanceTurn(nextRound);
  return { ok: true, state: withRound(state, nextRound) };
}

function handlePassTurn(
  state: GameState,
  round: RoundState,
  playerId: string,
  options?: { afterDraw?: boolean }
): ActionResult {
  if (!canPassTurn(round, playerId, options)) {
    return fail('PASS_NOT_ALLOWED');
  }
  return { ok: true, state: withRound(state, advanceTurn(round)) };
}

function handleDeployBeacon(
  state: GameState,
  round: RoundState,
  playerId: string,
  options?: { afterDraw?: boolean }
): ActionResult {
  if (round.table.warpTrails[playerId]?.distressBeacon.active) {
    return fail('BEACON_ALREADY_ACTIVE');
  }
  if (!canDeployDistressBeacon(round, playerId, options)) {
    if (
      !options?.afterDraw &&
      getLegalMoves(round, playerId).length === 0 &&
      round.unchartedSectors.length > 0
    ) {
      return fail('MUST_DRAW_FIRST');
    }
    return fail('BEACON_NOT_ALLOWED');
  }

  const trail = round.table.warpTrails[playerId];
  let nextRound = updateTable(round, {
    ...round.table,
    warpTrails: {
      ...round.table.warpTrails,
      [playerId]: {
        ...trail,
        distressBeacon: { active: true },
      },
    },
    redAlert:
      round.table.redAlert?.responsiblePlayerId === playerId
        ? {
            ...round.table.redAlert,
            responsiblePlayerId: nextActivePlayerId(round, playerId),
          }
        : round.table.redAlert,
  });

  nextRound = advanceTurn(nextRound);
  return { ok: true, state: withRound(state, nextRound) };
}

function handleDeclareTreaty(
  state: GameState,
  round: RoundState,
  playerId: string
): ActionResult {
  if (!round.treatyDeclarationRequired || round.roundWinnerId !== playerId) {
    return fail('TREATY_NOT_REQUIRED');
  }

  const nextRound: RoundState = {
    ...round,
    treatyDeclared: true,
    phase: 'ended',
  };

  return { ok: true, state: withRound(state, nextRound) };
}

function qResolutionBlocksAction(
  round: RoundState,
  playerId: string
): boolean {
  return (
    round.qPendingInvoker === playerId ||
    round.qGamblePending?.playerId === playerId
  );
}

function handleQFlash(
  state: GameState,
  round: RoundState,
  playerId: string,
  effectKind: QFlashEffectKind
): ActionResult {
  if (!state.modules.qContinuum.enabled) {
    return fail('INVALID_ROUTE');
  }

  if (round.qPendingInvoker !== playerId) {
    return fail('Q_FLASH_NOT_PENDING');
  }

  const effect = buildQFlashEffect(effectKind, state, round, playerId);
  if (!effect) {
    return fail('Q_FLASH_UNAVAILABLE');
  }

  const { round: afterEffect } = applyQFlashEffect(round, effect, playerId);
  let nextRound = afterEffect;

  const flash: QFlash = { invokedBy: playerId, effect };
  let nextState: GameState = {
    ...state,
    modules: {
      ...state.modules,
      qContinuum: {
        ...state.modules.qContinuum,
        activeFlash: flash,
      },
    },
    round: nextRound,
  };

  if (
    !nextRound.qGamblePending &&
    !isRedAlertBlocking(nextRound.table.redAlert, playerId) &&
    !isNavigationHaltedByFracture(nextRound.table.subspaceFracture)
  ) {
    nextRound = advanceTurn(nextRound);
    nextState = withRound(nextState, nextRound);
  }

  return { ok: true, state: nextState };
}

function handleQGamble(
  state: GameState,
  round: RoundState,
  playerId: string,
  keepIndex: 0 | 1
): ActionResult {
  if (!state.modules.qContinuum.enabled) {
    return fail('INVALID_ROUTE');
  }

  if (round.qGamblePending?.playerId !== playerId) {
    return fail('Q_GAMBLE_NOT_PENDING');
  }

  let nextRound = resolveQGamble(round, playerId, keepIndex);

  if (
    !isRedAlertBlocking(nextRound.table.redAlert, playerId) &&
    !isNavigationHaltedByFracture(nextRound.table.subspaceFracture)
  ) {
    nextRound = advanceTurn(nextRound);
  }

  return { ok: true, state: withRound(state, nextRound) };
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (action.type === 'END_ROUND') {
    if (state.phase !== 'active' || !state.round) {
      return fail('GAME_NOT_ACTIVE');
    }
    const round = state.round;
    if (round.phase !== 'ended' || round.roundWinnerId !== action.winnerId) {
      return fail('ROUND_NOT_PLAYING');
    }
    return scoreRound(state, round);
  }

  const roundOrViolation = requireActiveRound(state);
  if (typeof roundOrViolation === 'string') {
    return fail(roundOrViolation);
  }

  let round = roundOrViolation;

  switch (action.type) {
    case 'CHART_COORDINATE': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }

      if (!handContains(round.hands[action.playerId] ?? [], action.coordinate)) {
        return fail('COORDINATE_NOT_IN_HAND');
      }

      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('Q_FLASH_NOT_PENDING');
      }

      if (isNavigationHaltedByFracture(round.table.subspaceFracture)) {
        if (action.route.kind !== 'fracture-stabilizer') {
          return fail('FRACTURE_REQUIRES_STABILIZER');
        }
      } else if (isRedAlertBlocking(round.table.redAlert, action.playerId)) {
        if (action.route.kind !== 'red-alert-cover') {
          return fail('RED_ALERT_REQUIRED');
        }
      } else if (
        action.route.kind === 'fracture-stabilizer' ||
        action.route.kind === 'red-alert-cover'
      ) {
        return fail('INVALID_ROUTE');
      }

      if (
        action.route.kind === 'warp-trail' &&
        action.route.playerId !== action.playerId &&
        !trailsOpenToOthers(round, action.route.playerId)
      ) {
        return fail('SHIELDS_UP');
      }

      if (!isLegalMove(round, action.playerId, action.coordinate, action.route)) {
        return fail('INVALID_ROUTE');
      }

      try {
        round = applyChartToRoute(round, action.playerId, action.coordinate, action.route, {
          subspaceFractureEnabled: state.modules.subspaceFracture.enabled,
          qContinuumEnabled: state.modules.qContinuum.enabled,
        });
      } catch {
        return fail('INVALID_ROUTE');
      }

      return { ok: true, state: withRound(state, round) };
    }

    case 'DRAW_FROM_UNCHARTED': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('Q_FLASH_NOT_PENDING');
      }
      if (getLegalMoves(round, action.playerId).length > 0) {
        return fail('INVALID_ROUTE');
      }
      return handleDraw(state, round, action.playerId);
    }

    case 'PASS_RED_ALERT': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('Q_FLASH_NOT_PENDING');
      }
      return handlePassRedAlert(state, round, action.playerId);
    }

    case 'PASS_TURN': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('Q_FLASH_NOT_PENDING');
      }
      return handlePassTurn(state, round, action.playerId);
    }

    case 'DEPLOY_DISTRESS_BEACON': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('Q_FLASH_NOT_PENDING');
      }
      return handleDeployBeacon(state, round, action.playerId);
    }

    case 'DECLARE_TREATY': {
      return handleDeclareTreaty(state, round, action.playerId);
    }

    case 'INVOKE_Q_FLASH': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      return handleQFlash(state, round, action.playerId, action.effect);
    }

    case 'RESOLVE_Q_GAMBLE': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      return handleQGamble(state, round, action.playerId, action.keepIndex);
    }

    default:
      return fail('INVALID_ROUTE');
  }
}

export { getLegalMoves, advanceTurn };
