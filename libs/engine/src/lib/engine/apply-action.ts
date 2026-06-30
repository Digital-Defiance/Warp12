import {
  isDouble,
  type Coordinate,
  type PlacedCoordinate,
} from '../types/coordinate.js';
import type { GameAction, ActionResult, ChartRoute } from '../types/actions.js';
import type { GameState, RoundState, TableState } from '../types/game-state.js';
import type { QFlash } from '../types/modules.js';
import { subspaceFractureAppliesToDouble } from '../types/modules.js';
import type { SubspaceFractureScope } from '../types/subspace-fracture-scope.js';
import type { HouseRules } from '../types/house-rules.js';
import type { QFlashEffectKind } from '../types/q-continuum.js';
import type { WarpTrail } from '../types/trails.js';
import {
  handContains,
  removeCoordinateFromHand,
} from '../domino/coordinates.js';
import {
  isNavigationHaltedByFracture,
  isRedAlertBlocking,
  blocksRoundWin,
  type RedAlert,
  type SubspaceFracture,
} from '../types/anomalies.js';
import {
  neutralZoneOpenValue,
  trailOpenValue,
} from '../table/table-state.js';
import { isPipExhausted } from '../table/pip-inventory.js';
import {
  fail,
  requireActiveRound,
  requirePlayerTurn,
  withRound,
} from './helpers.js';
import {
  applyQFlashEffect,
  buildQFlashEffect,
  clearTemporalInversionOnDouble,
  consumeFractureImmunity,
  advanceToNextPlayer,
  resolveQGamble,
  trailsOpenToOthers,
  resolveRoundWinAllStop,
} from './q-continuum.js';
import { getLegalMoves, isLegalMove, placedTile } from './legal-moves.js';
import {
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
} from './beacon.js';
import { scoreRound } from './scoring.js';
import {
  finalizeRoundWinAfterQ,
  maybeEndBlockedRound,
} from './round-resolution.js';
import { resolveDeadRedAlert } from './dead-red-alert.js';
import { archiveFractureStabilizers } from '../table/fracture-stabilizers.js';
import {
  advanceTurnWithDropToImpulse,
  applyDropToImpulsePenaltyDraw,
  maybeMarkDropToImpulsePending,
} from './drop-to-impulse.js';

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
  site: Pick<SubspaceFracture, 'neutralZone' | 'trailCaptainId'>
): SubspaceFracture {
  return {
    active: true,
    anchor,
    stabilizers: [],
    requiredValue: anchor.coordinate.low,
    ...(site.neutralZone ? { neutralZone: true } : {}),
    ...(site.trailCaptainId ? { trailCaptainId: site.trailCaptainId } : {}),
  };
}

function fractureSiteForRoute(
  route: ChartRoute
): Pick<SubspaceFracture, 'neutralZone' | 'trailCaptainId'> {
  if (route.kind === 'neutral-zone') {
    return { neutralZone: true };
  }
  if (route.kind === 'warp-trail') {
    return { trailCaptainId: route.playerId };
  }
  return {};
}

function openRedAlert(
  anchor: PlacedCoordinate,
  responsiblePlayerId: string,
  trailPlayerId: string,
  neutralZone = false
): RedAlert {
  return {
    active: true,
    anchor,
    responsiblePlayerId,
    trailPlayerId,
    ...(neutralZone ? { neutralZone: true } : {}),
  };
}

function resolvePostChartAnomalies(
  round: RoundState,
  playerId: string,
  placed: PlacedCoordinate,
  route: ChartRoute,
  wasCover: boolean,
  subspaceFracture: { enabled: boolean; scope: SubspaceFractureScope }
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

  if (playedDouble && !wasCover) {
    if (route.kind === 'warp-trail' || route.kind === 'neutral-zone') {
      const doubleIsDead = isPipExhausted(round, placed.coordinate.low);
      if (!doubleIsDead) {
        redAlert = openRedAlert(
          placed,
          playerId,
          route.kind === 'warp-trail' ? route.playerId : '',
          route.kind === 'neutral-zone'
        );
        const { round: afterImmunity, consumed } = consumeFractureImmunity(nextRound);
        nextRound = afterImmunity;
        const fractureApplies =
          subspaceFracture.enabled &&
          subspaceFractureAppliesToDouble(route, playerId, subspaceFracture.scope);
        const fractureImmune = consumed && onOwnTrail;
        if (fractureApplies && !fractureImmune) {
          const existingFracture = table.subspaceFracture;
          if (existingFracture && existingFracture.stabilizers.length > 0) {
            table = archiveFractureStabilizers(table, existingFracture);
          }
          table = {
            ...table,
            redAlert,
            subspaceFracture: openSubspaceFracture(
              placed,
              fractureSiteForRoute(route)
            ),
          };
        } else {
          table = { ...table, redAlert };
        }
      }
    } else {
      table = { ...table, redAlert };
    }
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
    subspaceFracture: { enabled: boolean; scope: SubspaceFractureScope };
    qContinuumEnabled: boolean;
    houseRules: HouseRules;
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
      const fractureResolved = stabilizers.length >= 3;
      if (fractureResolved) {
        const resolvedFracture = {
          ...fracture,
          stabilizers,
          active: false,
        };
        table = archiveFractureStabilizers(table, resolvedFracture);
        table = {
          ...table,
          subspaceFracture: {
            ...resolvedFracture,
            stabilizers: [],
          },
        };
      } else {
        table = {
          ...table,
          subspaceFracture: {
            ...fracture,
            stabilizers,
            active: true,
          },
        };
      }
      const redAlert = table.redAlert;
      if (
        fractureResolved &&
        redAlert?.active &&
        redAlert.anchor.index === fracture.anchor.index &&
        redAlert.anchor.coordinate.low === fracture.anchor.coordinate.low &&
        redAlert.anchor.coordinate.high === fracture.anchor.coordinate.high
      ) {
        table = { ...table, redAlert: null };
      }
      break;
    }
    case 'red-alert-cover': {
      if (route.neutralZone) {
        const connectingValue = neutralZoneOpenValue(
          table.neutralZone,
          round.spacedockValue
        );
        const tile = placedTile(
          removed,
          table.neutralZone.tiles.length,
          connectingValue
        )!;
        placed = tile;
        wasCover = true;
        table = {
          ...table,
          neutralZone: {
            tiles: [...table.neutralZone.tiles, tile],
          },
        };
        break;
      }

      const trailPlayerId = route.trailPlayerId!;
      const trail = table.warpTrails[trailPlayerId];
      const connectingValue = trailOpenValue(trail, round.spacedockValue);
      const tile = placedTile(removed, trail.tiles.length, connectingValue)!;
      placed = tile;
      wasCover = true;
      table = {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          [trailPlayerId]: appendToTrail(trail, tile),
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
        route.playerId === playerId && !options.houseRules.beaconClearsOnAnyPlay
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

  if (options.houseRules.beaconClearsOnAnyPlay) {
    const trail = table.warpTrails[playerId];
    if (trail?.distressBeacon.active) {
      table = {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          [playerId]: clearDistressBeacon(trail),
        },
      };
    }
  }

  nextRound = resolvePostChartAnomalies(
    updateTable(nextRound, table),
    playerId,
    placed,
    route,
    wasCover,
    options.subspaceFracture
  );

  nextRound = resolveDeadRedAlert(nextRound);

  const playedZeroZero =
    options.qContinuumEnabled &&
    isDouble(placed.coordinate) &&
    placed.coordinate.low === 0 &&
    route.kind === 'warp-trail' &&
    route.playerId === playerId;

  if (playedZeroZero) {
    nextRound = { ...nextRound, qPendingInvoker: playerId };
  }

  const winnerHand = nextRound.hands[playerId] ?? [];
  const emptyHandWin = winnerHand.length === 0;
  const openingIncomplete =
    options.houseRules.roundStarterPlaysTwo &&
    playerId === nextRound.table.spacedock.placedBy &&
    (nextRound.table.warpTrails[playerId]?.tiles.length ?? 0) < 2;

  if (
    !emptyHandWin &&
    options.houseRules.dropToImpulseCall &&
    winnerHand.length === 1
  ) {
    nextRound = maybeMarkDropToImpulsePending(
      nextRound,
      playerId,
      options.houseRules
    );
  }

  if (nextRound.qPendingInvoker || nextRound.qGamblePending) {
    if (emptyHandWin && !blocksRoundWin(nextRound, playerId) && !openingIncomplete) {
      nextRound = {
        ...nextRound,
        pendingRoundWin: { playerId, routeKind: route.kind },
      };
    }
    return { ...nextRound, mandatoryPlay: null };
  }

  if (emptyHandWin && !blocksRoundWin(nextRound, playerId) && !openingIncomplete) {
    const ceremony = resolveRoundWinAllStop(
      nextRound,
      route.kind,
      options.houseRules
    );
    nextRound = {
      ...nextRound,
      allStopRequired: ceremony.allStopRequired,
      allStopDeclared: ceremony.allStopDeclared,
      roundWinnerId: playerId,
      phase: ceremony.phase,
      mandatoryPlay: null,
    };
    return maybeEndBlockedRound(nextRound, options.houseRules);
  }

  nextRound = { ...nextRound, mandatoryPlay: null };

  if (
    isRedAlertBlocking(nextRound.table.redAlert, playerId) ||
    isNavigationHaltedByFracture(
      nextRound.table.subspaceFracture,
      nextRound.table.redAlert
    )
  ) {
    const ownTiles = nextRound.table.warpTrails[playerId]?.tiles.length ?? 0;
    if (
      options.houseRules.roundStarterPlaysTwo &&
      playerId === nextRound.table.spacedock.placedBy &&
      ownTiles === 1
    ) {
      nextRound = {
        ...nextRound,
        roundStarterOpening: { playerId },
      };
    }
    return nextRound;
  }

  if (
    options.houseRules.dropToImpulseCall &&
    nextRound.dropToImpulseCallPending === playerId
  ) {
    return maybeEndBlockedRound(nextRound, options.houseRules);
  }

  return resolveRoundStarterOpeningTurn(
    nextRound,
    playerId,
    options.houseRules
  );
}

function ownTrailChartMoves(
  round: RoundState,
  playerId: string,
  houseRules: HouseRules
) {
  return getLegalMoves(round, playerId, houseRules).filter(
    (move) =>
      move.route.kind === 'warp-trail' && move.route.playerId === playerId
  );
}

function applyRoundStarterOpeningFailure(
  round: RoundState,
  playerId: string,
  houseRules: HouseRules
): RoundState {
  const trail = round.table.warpTrails[playerId];
  const withBeacon = updateTable(round, {
    ...round.table,
    warpTrails: {
      ...round.table.warpTrails,
      [playerId]: {
        ...trail,
        distressBeacon: { active: true },
      },
    },
  });
  const cleared: RoundState = {
    ...withBeacon,
    roundStarterOpening: null,
  };
  return maybeEndBlockedRound(advanceTurn(cleared, houseRules), houseRules);
}

function resolveRoundStarterOpeningTurn(
  nextRound: RoundState,
  playerId: string,
  houseRules: HouseRules
): RoundState {
  if (!houseRules.roundStarterPlaysTwo) {
    return maybeEndBlockedRound(advanceTurn(nextRound, houseRules), houseRules);
  }
  if (playerId !== nextRound.table.spacedock.placedBy) {
    return maybeEndBlockedRound(advanceTurn(nextRound, houseRules), houseRules);
  }

  const ownTiles = nextRound.table.warpTrails[playerId]?.tiles.length ?? 0;
  if (ownTiles >= 2) {
    nextRound = { ...nextRound, roundStarterOpening: null };
    return maybeEndBlockedRound(advanceTurn(nextRound, houseRules), houseRules);
  }

  if (ownTiles !== 1) {
    return maybeEndBlockedRound(advanceTurn(nextRound, houseRules), houseRules);
  }

  nextRound = {
    ...nextRound,
    roundStarterOpening: { playerId },
  };

  if (
    isRedAlertBlocking(nextRound.table.redAlert, playerId) ||
    isNavigationHaltedByFracture(
      nextRound.table.subspaceFracture,
      nextRound.table.redAlert
    )
  ) {
    return nextRound;
  }

  if (ownTrailChartMoves(nextRound, playerId, houseRules).length > 0) {
    return nextRound;
  }

  return applyRoundStarterOpeningFailure(nextRound, playerId, houseRules);
}

function advanceTurn(round: RoundState, houseRules: HouseRules): RoundState {
  if (round.qPendingInvoker || round.qGamblePending) {
    return round;
  }

  return advanceTurnWithDropToImpulse(round, houseRules);
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

  if (
    nextRound.dropToImpulseCallPending === playerId &&
    (nextRound.hands[playerId]?.length ?? 0) !== 1
  ) {
    nextRound = { ...nextRound, dropToImpulseCallPending: null };
  }

  const legalWithDrawn = getLegalMoves(nextRound, playerId, state.houseRules).filter(
    (move) =>
      move.coordinate.low === drawn.low &&
      move.coordinate.high === drawn.high
  );

  if (legalWithDrawn.length > 0) {
    nextRound = {
      ...nextRound,
      mandatoryPlay: { playerId, coordinate: drawn },
    };
    return { ok: true, state: withRound(state, nextRound) };
  }

  if (isRedAlertBlocking(nextRound.table.redAlert, playerId)) {
    if (canPassRedAlert(nextRound, playerId, { afterDraw: true, houseRules: state.houseRules })) {
      return handlePassRedAlert(state, nextRound, playerId, { afterDraw: true });
    }
  }

  if (canDeployDistressBeacon(nextRound, playerId, { afterDraw: true, houseRules: state.houseRules })) {
    return handleDeployBeacon(state, nextRound, playerId, { afterDraw: true });
  }

  if (canPassTurn(nextRound, playerId, { afterDraw: true, houseRules: state.houseRules })) {
    return handlePassTurn(state, nextRound, playerId, { afterDraw: true });
  }

  return {
    ok: true,
    state: withRound(state, maybeEndBlockedRound(advanceTurn(nextRound, state.houseRules), state.houseRules)),
  };
}

function handlePassRedAlert(
  state: GameState,
  round: RoundState,
  playerId: string,
  options?: { afterDraw?: boolean }
): ActionResult {
  if (!canPassRedAlert(round, playerId, { ...options, houseRules: state.houseRules })) {
    const redAlert = round.table.redAlert;
    if (!redAlert?.active || redAlert.responsiblePlayerId !== playerId) {
      return fail('RED_ALERT_NOT_ACTIVE');
    }
    if (getLegalMoves(round, playerId, state.houseRules).length > 0) {
      return fail('RED_ALERT_COVER_AVAILABLE');
    }
    if (round.unchartedSectors.length > 0) {
      return fail('MUST_DRAW_FIRST');
    }
    return fail('RED_ALERT_NOT_ACTIVE');
  }

  const redAlert = round.table.redAlert!;

  const { nextId: nextResponsible, qEffects } = advanceToNextPlayer(
    round,
    playerId
  );
  let nextRound = updateTable(round, {
    ...round.table,
    redAlert: {
      ...redAlert,
      responsiblePlayerId: nextResponsible,
    },
  });
  nextRound = { ...nextRound, qEffects };

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

  nextRound = advanceTurn(nextRound, state.houseRules);
  nextRound = maybeEndBlockedRound(nextRound, state.houseRules);
  return { ok: true, state: withRound(state, nextRound) };
}

function handlePassTurn(
  state: GameState,
  round: RoundState,
  playerId: string,
  options?: { afterDraw?: boolean }
): ActionResult {
  if (!canPassTurn(round, playerId, { ...options, houseRules: state.houseRules })) {
    return fail('PASS_NOT_ALLOWED');
  }
  let nextRound = maybeEndBlockedRound(advanceTurn(round, state.houseRules), state.houseRules);
  return { ok: true, state: withRound(state, nextRound) };
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
  if (!canDeployDistressBeacon(round, playerId, { ...options, houseRules: state.houseRules })) {
    if (
      !options?.afterDraw &&
      getLegalMoves(round, playerId, state.houseRules).length === 0 &&
      round.unchartedSectors.length > 0
    ) {
      return fail('MUST_DRAW_FIRST');
    }
    return fail('BEACON_NOT_ALLOWED');
  }

  const trail = round.table.warpTrails[playerId];
  let qEffects = round.qEffects;
  let redAlert = round.table.redAlert;
  if (redAlert?.responsiblePlayerId === playerId) {
    const advanced = advanceToNextPlayer(round, playerId);
    qEffects = advanced.qEffects;
    redAlert = {
      ...redAlert,
      responsiblePlayerId: advanced.nextId,
    };
  }
  let nextRound = updateTable(round, {
    ...round.table,
    warpTrails: {
      ...round.table.warpTrails,
      [playerId]: {
        ...trail,
        distressBeacon: { active: true },
      },
    },
    redAlert,
  });
  nextRound = { ...nextRound, qEffects };

  nextRound = advanceTurn(nextRound, state.houseRules);
  nextRound = maybeEndBlockedRound(nextRound, state.houseRules);
  return { ok: true, state: withRound(state, nextRound) };
}

function handleAllStop(
  state: GameState,
  round: RoundState,
  playerId: string
): ActionResult {
  if (!round.allStopRequired || round.allStopDeclared) {
    return fail('ALL_STOP_NOT_REQUIRED');
  }

  const winnerId = round.roundWinnerId;
  if (winnerId != null && winnerId !== playerId) {
    return fail('ALL_STOP_NOT_REQUIRED');
  }

  const hand = round.hands[playerId] ?? [];
  if (winnerId == null && hand.length > 0) {
    return fail('ALL_STOP_NOT_REQUIRED');
  }

  const nextRound: RoundState = {
    ...round,
    roundWinnerId: winnerId ?? playerId,
    allStopDeclared: true,
    phase: 'ended',
  };

  return { ok: true, state: withRound(state, nextRound) };
}

function handleDropToImpulse(
  state: GameState,
  round: RoundState,
  playerId: string
): ActionResult {
  if (!state.houseRules.dropToImpulseCall) {
    return fail('DROP_TO_IMPULSE_NOT_REQUIRED');
  }
  if (round.dropToImpulseCallPending !== playerId) {
    return fail('DROP_TO_IMPULSE_NOT_REQUIRED');
  }
  if ((round.hands[playerId] ?? []).length !== 1) {
    return fail('DROP_TO_IMPULSE_NOT_REQUIRED');
  }

  const nextRound = maybeEndBlockedRound(
    advanceTurn(
      { ...round, dropToImpulseCallPending: null },
      state.houseRules
    ),
    state.houseRules
  );
  return { ok: true, state: withRound(state, nextRound) };
}

function handleCatchDropToImpulse(
  state: GameState,
  round: RoundState,
  challengerId: string,
  targetPlayerId: string
): ActionResult {
  if (!state.houseRules.dropToImpulseCall) {
    return fail('CATCH_DROP_TO_IMPULSE_NOT_ALLOWED');
  }
  if (challengerId === targetPlayerId) {
    return fail('CATCH_DROP_TO_IMPULSE_NOT_ALLOWED');
  }
  if (round.dropToImpulseCatchable !== targetPlayerId) {
    return fail('CATCH_DROP_TO_IMPULSE_NOT_ALLOWED');
  }
  if ((round.hands[targetPlayerId] ?? []).length !== 1) {
    return fail('CATCH_DROP_TO_IMPULSE_NOT_ALLOWED');
  }

  const penalized = applyDropToImpulsePenaltyDraw(
    round,
    targetPlayerId,
    state.houseRules.dropToImpulseCatchPenalty
  );
  if (!penalized) {
    return fail('EMPTY_UNCHARTED');
  }

  const nextRound = maybeEndBlockedRound(penalized, state.houseRules);
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
  let nextRound = finalizeRoundWinAfterQ(afterEffect, state.houseRules);

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

  if (nextRound.phase === 'ended') {
    return { ok: true, state: nextState };
  }

  if (
    !nextRound.qGamblePending &&
    !isRedAlertBlocking(nextRound.table.redAlert, playerId) &&
    !isNavigationHaltedByFracture(
      nextRound.table.subspaceFracture,
      nextRound.table.redAlert
    )
  ) {
    nextRound = maybeEndBlockedRound(advanceTurn(nextRound, state.houseRules), state.houseRules);
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

  let nextRound = finalizeRoundWinAfterQ(resolveQGamble(round, playerId, keepIndex), state.houseRules);

  if (nextRound.phase === 'ended') {
    return { ok: true, state: withRound(state, nextRound) };
  }

  if (
    !isRedAlertBlocking(nextRound.table.redAlert, playerId) &&
    !isNavigationHaltedByFracture(
      nextRound.table.subspaceFracture,
      nextRound.table.redAlert
    )
  ) {
    nextRound = maybeEndBlockedRound(advanceTurn(nextRound, state.houseRules), state.houseRules);
  }

  return { ok: true, state: withRound(state, nextRound) };
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (action.type === 'END_ROUND') {
    if (state.phase !== 'active' || !state.round) {
      return fail('GAME_NOT_ACTIVE');
    }
    const round = state.round;
    if (round.phase !== 'ended') {
      return fail('ROUND_NOT_PLAYING');
    }
    if (round.roundBlocked) {
      if (action.winnerId !== null) {
        return fail('ROUND_NOT_PLAYING');
      }
      return scoreRound(state, round);
    }
    if (round.roundWinnerId !== action.winnerId) {
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

      if (
        isNavigationHaltedByFracture(
          round.table.subspaceFracture,
          round.table.redAlert
        )
      ) {
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

      if (!isLegalMove(round, action.playerId, action.coordinate, action.route, state.houseRules)) {
        return fail('INVALID_ROUTE');
      }

      try {
        round = applyChartToRoute(round, action.playerId, action.coordinate, action.route, {
          subspaceFracture: {
            enabled: state.modules.subspaceFracture.enabled,
            scope: state.modules.subspaceFracture.scope,
          },
          qContinuumEnabled: state.modules.qContinuum.enabled,
          houseRules: state.houseRules,
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
      if (getLegalMoves(round, action.playerId, state.houseRules).length > 0) {
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

    case 'ALL_STOP': {
      return handleAllStop(state, round, action.playerId);
    }

    case 'DROP_TO_IMPULSE': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      return handleDropToImpulse(state, round, action.playerId);
    }

    case 'CATCH_DROP_TO_IMPULSE': {
      if (!state.captains.some((captain) => captain.id === action.challengerId)) {
        return fail('CATCH_DROP_TO_IMPULSE_NOT_ALLOWED');
      }
      return handleCatchDropToImpulse(
        state,
        round,
        action.challengerId,
        action.targetPlayerId
      );
    }

    case 'RETURN_TO_WARP': {
      return fail('RETURN_TO_WARP_NOT_ALLOWED');
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
