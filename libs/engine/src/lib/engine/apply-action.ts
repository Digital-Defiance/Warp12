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
import type { FlashEffectKind } from '../types/continuum.js';
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
} from './continuum.js';
import {
  getLegalMoves,
  isLegalMove,
  placedTile,
  routineChartsBlockedByManualShieldWindow,
} from './legal-moves.js';
import { sameTrailGroup, trailKeyFor } from './squadrons.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canSensorSweep,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsManually,
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
  isDropToImpulseAnnouncePending,
  maybeMarkDropToImpulsePending,
} from './drop-to-impulse.js';
import {
  applySensorGridToRound,
  removeFromSensorGrid,
  refillSensorGrid,
} from './sensor-grid.js';
import {
  executeWarpDriveSpool,
} from './warp-drive-spool.js';
import {
  processDraftPick,
  isDraftComplete,
  collectRemainingTiles,
} from './drafting.js';

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

/** Deploy (activate) a Distress Beacon, resetting the manual-shield close gate. */
function deployBeaconOnTrail(trail: WarpTrail): WarpTrail {
  return {
    ...trail,
    distressBeacon: { active: true, chartedOwnTrailSinceDown: false },
  };
}

/**
 * Module Lambda: Wormhole swap. When a double is played on Neutral Zone,
 * the captain's personal trail swaps with the Neutral Zone.
 * Distress beacon on the captain's trail is destroyed during transit.
 */
function executeWormholeSwap(
  round: RoundState,
  playerId: string
): RoundState {
  const table = round.table;
  const trailKey = trailKeyFor(round, playerId);
  const captainTrail = table.warpTrails[trailKey];
  const neutralZone = table.neutralZone;

  if (!captainTrail) {
    // No trail to swap (shouldn't happen in practice)
    return round;
  }

  // Swap the trails
  const newCaptainTrail: WarpTrail = {
    playerId: trailKey,
    tiles: neutralZone.tiles,
    distressBeacon: { active: false, chartedOwnTrailSinceDown: false }, // Beacon destroyed during transit
  };

  const newNeutralZone = {
    tiles: captainTrail.tiles,
  };

  const newTable: TableState = {
    ...table,
    warpTrails: {
      ...table.warpTrails,
      [trailKey]: newCaptainTrail,
    },
    neutralZone: newNeutralZone,
  };

  return {
    ...round,
    table: newTable,
    wormholeOpened: true, // Signal for sound effect
  };
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
  subspaceFracture: { enabled: boolean; scope: SubspaceFractureScope },
  maxPip?: number,
  wormholeSwapped?: boolean
): RoundState {
  let table = round.table;
  let redAlert = table.redAlert;
  let nextRound = round;

  if (wasCover && redAlert?.active) {
    redAlert = null;
  }

  const playedDouble = isDouble(placed.coordinate);
  const onOwnTrail =
    route.kind === 'warp-trail' && sameTrailGroup(round, playerId, route.playerId);

  if (playedDouble) {
    nextRound = clearTemporalInversionOnDouble(nextRound);
  }

  if (playedDouble && !wasCover) {
    if (route.kind === 'warp-trail' || route.kind === 'neutral-zone') {
      const doubleIsDead = isPipExhausted(
        round,
        placed.coordinate.low,
        maxPip
      );
      if (!doubleIsDead) {
        // After wormhole, treat neutral-zone play as warp-trail play for Red Alert
        const effectiveTrailPlayerId = wormholeSwapped 
          ? playerId 
          : (route.kind === 'warp-trail' ? route.playerId : '');
        const effectiveNeutralZone = wormholeSwapped ? false : (route.kind === 'neutral-zone');
        
        redAlert = openRedAlert(
          placed,
          playerId,
          effectiveTrailPlayerId,
          effectiveNeutralZone
        );
        const { round: afterImmunity, consumed } = consumeFractureImmunity(nextRound);
        nextRound = afterImmunity;
        const fractureApplies =
          subspaceFracture.enabled &&
          subspaceFractureAppliesToDouble(route, playerId, subspaceFracture.scope, nextRound);
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
    maxPip?: number;
    modules?: import('../types/modules.js').GameModules;
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
  if (
    options.houseRules.dropToImpulseCall &&
    nextRound.dropToImpulseCallPending === playerId &&
    hand.length !== 1
  ) {
    nextRound = { ...nextRound, dropToImpulseCallPending: null };
  }
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
        // Module Delta: Transfer hazard marker when touching Neutral Zone
        if (options.modules?.warpDriveSpool?.enabled) {
          nextRound = { ...nextRound, hazardMarkerHolder: playerId };
        }
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
      
      // Module Lambda: Wormhole trigger - swap trails BEFORE placing the double
      const wormholesEnabled = options.modules?.wormholes?.enabled ?? false;
      const playedDouble = isDouble(placed.coordinate);
      const wormholeSwapped = wormholesEnabled && playedDouble;
      
      if (wormholeSwapped) {
        // Execute swap BEFORE placing the tile
        nextRound = executeWormholeSwap(nextRound, playerId);
        // Get updated table after swap
        table = nextRound.table;
        
        // Place the tile on the captain's NEW trail (which is the old NZ after swap)
        const swapTrailKey = trailKeyFor(nextRound, playerId);
        table = {
          ...table,
          warpTrails: {
            ...table.warpTrails,
            [swapTrailKey]: appendToTrail(table.warpTrails[swapTrailKey]!, placed),
          },
        };
      } else {
        // No wormhole - place normally on neutral zone
        table = {
          ...table,
          neutralZone: {
            tiles: [...table.neutralZone.tiles, placed],
          },
        };
      }
      
      // Apply the table update to nextRound
      nextRound = updateTable(nextRound, table);
      
      // Module Delta: Transfer hazard marker when touching Neutral Zone
      if (options.modules?.warpDriveSpool?.enabled) {
        nextRound = { ...nextRound, hazardMarkerHolder: playerId };
      }
      
      // Store wormhole flag for Red Alert handling
      (nextRound as any)._wormholeSwapped = wormholeSwapped;
      break;
    }
    case 'warp-trail': {
      const trail = table.warpTrails[route.playerId];
      const connectingValue = trailOpenValue(trail, round.spacedockValue);
      placed = placedTile(removed, trail.tiles.length, connectingValue)!;
      // Module Zeta: "own trail" is the shared squad trail — any squadmate
      // charting it raises/services the shared beacon.
      const chartingOwnTrail = sameTrailGroup(round, playerId, route.playerId);
      const autoRaiseOnOwnTrail =
        chartingOwnTrail &&
        !options.houseRules.beaconClearsOnAnyPlay &&
        !options.houseRules.manualShieldControl;
      let updatedTrail = autoRaiseOnOwnTrail
        ? appendToTrail(clearDistressBeacon(trail), placed)
        : appendToTrail(trail, placed);
      // Manual shield control: charting your own trail does not auto-raise, but
      // it does earn back the right to raise shields manually (you have now
      // serviced your own trail since dropping them).
      if (
        options.houseRules.manualShieldControl &&
        chartingOwnTrail &&
        updatedTrail.distressBeacon.active &&
        updatedTrail.distressBeacon.chartedOwnTrailSinceDown !== true
      ) {
        updatedTrail = {
          ...updatedTrail,
          distressBeacon: {
            ...updatedTrail.distressBeacon,
            chartedOwnTrailSinceDown: true,
          },
        };
      }
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
    const ownTrailKey = trailKeyFor(round, playerId);
    const trail = table.warpTrails[ownTrailKey];
    if (trail?.distressBeacon.active) {
      table = {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          [ownTrailKey]: clearDistressBeacon(trail),
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
    options.subspaceFracture,
    options.maxPip,
    (nextRound as any)._wormholeSwapped || false
  );
  
  // Clean up temporary flag
  delete (nextRound as any)._wormholeSwapped;

  nextRound = resolveDeadRedAlert(nextRound, options.maxPip);

  const playedZeroZero =
    options.qContinuumEnabled &&
    isDouble(placed.coordinate) &&
    placed.coordinate.low === 0 &&
    route.kind === 'warp-trail' &&
    sameTrailGroup(nextRound, playerId, route.playerId);

  if (playedZeroZero) {
    nextRound = { ...nextRound, continuumPendingInvoker: playerId };
  }

  const winnerHand = nextRound.hands[playerId] ?? [];
  const emptyHandWin = winnerHand.length === 0;
  // Opening is incomplete until the starter finishes their one-time double chart
  // (or beacons out). Must not re-trigger on later turns, and must not key off
  // own-trail length (Neutral Zone opening leaves own trail empty).
  const stillInOpening =
    options.houseRules.roundStarterPlaysTwo &&
    playerId === nextRound.table.spacedock.placedBy &&
    !nextRound.roundStarterOpeningResolved;
  const completingSecondOpeningTile =
    stillInOpening && nextRound.roundStarterOpening?.playerId === playerId;
  const openingIncomplete = stillInOpening && !completingSecondOpeningTile;

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

  if (nextRound.continuumPendingInvoker || nextRound.continuumWagerPending) {
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
    // Round Starter Plays Two: after first opening tile (e.g. a double), keep
    // the turn for the cover / second chart — only once per round.
    if (
      options.houseRules.roundStarterPlaysTwo &&
      playerId === nextRound.table.spacedock.placedBy &&
      !nextRound.roundStarterOpeningResolved &&
      !nextRound.roundStarterOpening
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

function finishRoutineChartTurn(
  nextRound: RoundState,
  houseRules: HouseRules
): RoundState {
  if (houseRules.manualShieldControl) {
    return { ...nextRound, playedThisTurn: true };
  }
  return maybeEndBlockedRound(advanceTurn(nextRound, houseRules), houseRules);
}

function applyRoundStarterOpeningFailure(
  round: RoundState,
  playerId: string,
  houseRules: HouseRules
): RoundState {
  const trailKey = trailKeyFor(round, playerId);
  const trail = round.table.warpTrails[trailKey];
  const withBeacon = updateTable(round, {
    ...round.table,
    warpTrails: {
      ...round.table.warpTrails,
      [trailKey]: deployBeaconOnTrail(trail),
    },
  });
  const cleared: RoundState = {
    ...withBeacon,
    roundStarterOpening: null,
    roundStarterOpeningResolved: true,
    playedThisTurn: houseRules.manualShieldControl ? true : withBeacon.playedThisTurn,
  };
  if (houseRules.manualShieldControl) {
    return cleared;
  }
  return maybeEndBlockedRound(advanceTurn(cleared, houseRules), houseRules);
}

function resolveRoundStarterOpeningTurn(
  nextRound: RoundState,
  playerId: string,
  houseRules: HouseRules
): RoundState {
  if (!houseRules.roundStarterPlaysTwo) {
    return finishRoutineChartTurn(nextRound, houseRules);
  }
  if (playerId !== nextRound.table.spacedock.placedBy) {
    return finishRoutineChartTurn(nextRound, houseRules);
  }
  // Opening already finished this round — normal single-chart turns from here.
  if (nextRound.roundStarterOpeningResolved) {
    return finishRoutineChartTurn(nextRound, houseRules);
  }

  // Second opening tile — clear obligation, mark resolved, advance helm.
  if (nextRound.roundStarterOpening?.playerId === playerId) {
    nextRound = {
      ...nextRound,
      roundStarterOpening: null,
      roundStarterOpeningResolved: true,
    };
    return finishRoutineChartTurn(nextRound, houseRules);
  }

  // First opening tile — hold helm for the required second chart.
  nextRound = {
    ...nextRound,
    roundStarterOpening: { playerId },
    playedThisTurn: houseRules.manualShieldControl ? true : nextRound.playedThisTurn,
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

  // Check if player has any legal moves for second tile
  if (getLegalMoves(nextRound, playerId, houseRules).length > 0) {
    return nextRound;
  }

  return applyRoundStarterOpeningFailure(nextRound, playerId, houseRules);
}

function advanceTurn(round: RoundState, houseRules: HouseRules): RoundState {
  if (round.continuumPendingInvoker || round.continuumWagerPending) {
    return round;
  }

  return advanceTurnWithDropToImpulse(
    {
      ...round,
      playedThisTurn: false,
      drewThisTurn: false,
      shieldChangedThisTurn: false,
    },
    houseRules
  );
}

function handleDraw(
  state: GameState,
  round: RoundState,
  playerId: string
): ActionResult {
  if (round.unchartedSectors.length === 0) {
    return fail('EMPTY_UNCHARTED');
  }

  const handBefore = round.hands[playerId]?.length ?? 0;
  const [drawn, ...remaining] = round.unchartedSectors;
  let nextRound = updateHands(round, playerId, [
    ...(round.hands[playerId] ?? []),
    drawn,
  ]);
  nextRound = { ...nextRound, unchartedSectors: remaining, drewThisTurn: true };

  // Module Eta (Temporal Debt): Increment debt tokens when drawing from uncharted
  if (state.modules.temporalDebt?.enabled && nextRound.debtTokens) {
    const currentDebt = nextRound.debtTokens[playerId] ?? 0;
    nextRound = {
      ...nextRound,
      debtTokens: {
        ...nextRound.debtTokens,
        [playerId]: currentDebt + 1,
      },
    };
  }

  // Return to warp: an at-impulse hand (exactly one tile) drew back up. This
  // holds across every impulse path (announced, caught, or same-turn) because it
  // keys off the hand growing from 1, not the announce/catch flags.
  if (state.houseRules.dropToImpulseCall && handBefore === 1) {
    nextRound = { ...nextRound, returnedToWarp: true };
  }

  if ((nextRound.hands[playerId]?.length ?? 0) !== 1) {
    if (nextRound.dropToImpulseCallPending === playerId) {
      nextRound = { ...nextRound, dropToImpulseCallPending: null };
    }
    if (nextRound.dropToImpulseCatchable === playerId) {
      nextRound = { ...nextRound, dropToImpulseCatchable: null };
    }
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

function handleSensorSweep(
  state: GameState,
  round: RoundState,
  playerId: string,
  coordinate: Coordinate
): ActionResult {
  if (round.sensorGrid.length === 0) {
    return fail('EMPTY_SENSOR_GRID');
  }

  // Verify the coordinate is in the sensor grid
  const { sensorGrid: gridAfterRemove, found } = removeFromSensorGrid(
    round.sensorGrid,
    coordinate
  );

  if (!found) {
    return fail('COORDINATE_NOT_IN_SENSOR_GRID');
  }

  // Same logic as handleDraw: add to hand, check for mandatory play
  const handBefore = round.hands[playerId]?.length ?? 0;
  let nextRound = updateHands(round, playerId, [
    ...(round.hands[playerId] ?? []),
    coordinate,
  ]);
  
  nextRound = { ...nextRound, sensorGrid: gridAfterRemove, drewThisTurn: true };

  // Refill the sensor grid from uncharted sectors
  const { sensorGrid: refilled, unchartedSectors: remaining } = refillSensorGrid(
    nextRound.sensorGrid,
    nextRound.unchartedSectors,
    state.modules.sensorGrid.gridSize
  );
  nextRound = { ...nextRound, sensorGrid: refilled, unchartedSectors: remaining };

  // Return to warp: an at-impulse hand (exactly one tile) drew back up
  if (state.houseRules.dropToImpulseCall && handBefore === 1) {
    nextRound = { ...nextRound, returnedToWarp: true };
  }

  if ((nextRound.hands[playerId]?.length ?? 0) !== 1) {
    if (nextRound.dropToImpulseCallPending === playerId) {
      nextRound = { ...nextRound, dropToImpulseCallPending: null };
    }
    if (nextRound.dropToImpulseCatchable === playerId) {
      nextRound = { ...nextRound, dropToImpulseCatchable: null };
    }
  }

  const legalWithDrawn = getLegalMoves(nextRound, playerId, state.houseRules).filter(
    (move) =>
      move.coordinate.low === coordinate.low &&
      move.coordinate.high === coordinate.high
  );

  if (legalWithDrawn.length > 0) {
    nextRound = {
      ...nextRound,
      mandatoryPlay: { playerId, coordinate },
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

function handleWarpDriveSpool(
  state: GameState,
  round: RoundState,
  playerId: string,
  route: Exclude<ChartRoute, { kind: 'fracture-stabilizer' } | { kind: 'red-alert-cover' }>
): ActionResult {
  // Determine the starting endpoint for the spool
  let startEndpoint: number;

  if (route.kind === 'warp-trail') {
    const trail = round.table.warpTrails[route.playerId];
    if (!trail) {
      return fail('INVALID_ROUTE');
    }
    
    // Check shields if playing on an opposing squad's trail
    if (
      !sameTrailGroup(round, playerId, route.playerId) &&
      !trailsOpenToOthers(round, route.playerId)
    ) {
      return fail('SHIELDS_UP');
    }

    const openValue = trailOpenValue(trail, round.spacedockValue);
    if (openValue === null) {
      return fail('INVALID_ROUTE');
    }
    startEndpoint = openValue;
  } else if (route.kind === 'neutral-zone') {
    const openValue = neutralZoneOpenValue(round.table.neutralZone, round.spacedockValue);
    if (openValue === null) {
      return fail('INVALID_ROUTE');
    }
    startEndpoint = openValue;
  } else {
    return fail('INVALID_ROUTE');
  }

  // Execute the warp drive spool
  // IMPORTANT: Combine uncharted sectors AND sensor grid for spool draw pool
  // The sensor grid tiles should be available for spooling
  const drawPool = [...round.unchartedSectors, ...round.sensorGrid];
  const spoolResult = executeWarpDriveSpool(
    startEndpoint,
    drawPool,
    state.modules,
    route,
    playerId,
    round
  );

  // Update round state with spool results
  let nextRound = round;
  let currentConnectingValue = startEndpoint;

  // Add played tiles to the appropriate trail
  for (let i = 0; i < spoolResult.tilesPlayed.length; i++) {
    const tile = spoolResult.tilesPlayed[i];
    
    if (route.kind === 'warp-trail') {
      const trail = nextRound.table.warpTrails[route.playerId];
      if (!trail) {
        return fail('INVALID_ROUTE');
      }
      
      const placed = placedTile(tile, trail.tiles.length, currentConnectingValue);
      if (!placed) {
        return fail('INVALID_ROUTE');
      }
      
      // Clear beacon if playing on own (squad) trail
      let updatedTrail = trail;
      if (
        sameTrailGroup(nextRound, playerId, route.playerId) &&
        trail.distressBeacon.active
      ) {
        updatedTrail = clearDistressBeacon(trail);
      }
      
      nextRound = {
        ...nextRound,
        table: {
          ...nextRound.table,
          warpTrails: {
            ...nextRound.table.warpTrails,
            [route.playerId]: appendToTrail(updatedTrail, placed),
          },
        },
      };
      
      currentConnectingValue = placed.openValue;
    } else if (route.kind === 'neutral-zone') {
      const nz = nextRound.table.neutralZone;
      const placed = placedTile(tile, nz.tiles.length, currentConnectingValue);
      if (!placed) {
        return fail('INVALID_ROUTE');
      }
      
      nextRound = {
        ...nextRound,
        table: {
          ...nextRound.table,
          neutralZone: {
            ...nextRound.table.neutralZone,
            tiles: [...nz.tiles, placed],
          },
        },
      };
      
      currentConnectingValue = placed.openValue;
    }
  }

  // Module Delta: Neutral Zone contact transfers the Hazard Marker (same as chart).
  // Never clear it — RULES §VI Delta: holder keeps it until someone else takes NZ.
  if (
    state.modules.warpDriveSpool?.enabled &&
    route.kind === 'neutral-zone' &&
    spoolResult.tilesPlayed.length > 0
  ) {
    nextRound = {
      ...nextRound,
      hazardMarkerHolder: playerId,
      hazardMarkerPassCount: 0,
    };
  }

  // Add mismatched tiles to player's hand
  if (spoolResult.tilesSentToHand.length > 0) {
    nextRound = updateHands(nextRound, playerId, [
      ...(nextRound.hands[playerId] ?? []),
      ...spoolResult.tilesSentToHand,
    ]);
  }

  // Update uncharted sectors AND sensor grid
  // After spool, remaining tiles go back to uncharted (sensor grid depleted during spool)
  nextRound = { 
    ...nextRound, 
    unchartedSectors: spoolResult.unchartedRemaining,
    sensorGrid: [], // Sensor grid is depleted during spool - refill on next draw action
  };

  // Handle Red Alert state if spool ended with uncovered double
  if (spoolResult.redAlertActive && spoolResult.tilesPlayed.length > 0) {
    const lastPlayed = spoolResult.tilesPlayed[spoolResult.tilesPlayed.length - 1];
    const isDouble = lastPlayed.low === lastPlayed.high;
    
    if (isDouble) {
      const tileIndex = (route.kind === 'warp-trail' 
        ? (nextRound.table.warpTrails[route.playerId]?.tiles.length ?? 1) - 1
        : nextRound.table.neutralZone.tiles.length - 1);
      
      const anchor: PlacedCoordinate = {
        coordinate: lastPlayed,
        index: tileIndex,
        openValue: lastPlayed.low,
      };
      
      nextRound = {
        ...nextRound,
        table: {
          ...nextRound.table,
          redAlert: {
            active: true,
            anchor,
            trailPlayerId: route.kind === 'warp-trail' ? route.playerId : '',
            neutralZone: route.kind === 'neutral-zone',
            responsiblePlayerId: playerId,
            passed: false,
          },
        },
      };
    }
  }

  // Handle Subspace Fracture state if spool ended mid-fracture
  if (spoolResult.fractureActive && spoolResult.tilesPlayed.length > 0) {
    const lastPlayed = spoolResult.tilesPlayed[spoolResult.tilesPlayed.length - 1];
    const tileIndex = (route.kind === 'warp-trail' 
      ? (nextRound.table.warpTrails[route.playerId]?.tiles.length ?? 1) - 1
      : nextRound.table.neutralZone.tiles.length - 1);
    
    const anchor: PlacedCoordinate = {
      coordinate: lastPlayed,
      index: tileIndex,
      openValue: lastPlayed.low,
    };
    
    nextRound = {
      ...nextRound,
      table: {
        ...nextRound.table,
        subspaceFracture: {
          active: true,
          anchor,
          stabilizers: [],
          requiredValue: lastPlayed.low,
          neutralZone: route.kind === 'neutral-zone',
          trailCaptainId: route.kind === 'warp-trail' ? route.playerId : undefined,
        },
      },
    };
  }

  // Mark that we played this turn
  nextRound = { ...nextRound, playedThisTurn: true };

  // Advance turn after spool completes
  nextRound = advanceTurn(nextRound, state.houseRules);

  return { ok: true, state: withRound(state, nextRound) };
}

function handlePassRedAlert(
  state: GameState,
  round: RoundState,
  playerId: string,
  options?: { afterDraw?: boolean }
): ActionResult {
  // The free pass (no draw, no beacon) only applies to the captain who charted
  // the double, while the alert is still in Yellow alert. Once it has been
  // passed once, standard draw/beacon rules apply to everyone.
  const freePass =
    state.houseRules.passRedAlertWithoutDraw &&
    round.table.redAlert?.passed !== true;

  if (!canPassRedAlert(round, playerId, { ...options, houseRules: state.houseRules })) {
    const redAlert = round.table.redAlert;
    if (!redAlert?.active || redAlert.responsiblePlayerId !== playerId) {
      return fail('RED_ALERT_NOT_ACTIVE');
    }
    if (getLegalMoves(round, playerId, state.houseRules).length > 0) {
      return fail('RED_ALERT_COVER_AVAILABLE');
    }
    if (round.unchartedSectors.length > 0 && !freePass) {
      return fail('MUST_DRAW_FIRST');
    }
    return fail('RED_ALERT_NOT_ACTIVE');
  }

  const redAlert = round.table.redAlert!;

  const { nextId: nextResponsible, continuumEffects } = advanceToNextPlayer(
    round,
    playerId
  );
  let nextRound = updateTable(round, {
    ...round.table,
    redAlert: {
      ...redAlert,
      responsiblePlayerId: nextResponsible,
      passed: true,
    },
  });
  nextRound = { ...nextRound, continuumEffects };

  if (!freePass) {
    const beaconTrailKey = trailKeyFor(nextRound, playerId);
    nextRound = {
      ...nextRound,
      table: {
        ...nextRound.table,
        warpTrails: {
          ...nextRound.table.warpTrails,
          [beaconTrailKey]: deployBeaconOnTrail(
            nextRound.table.warpTrails[beaconTrailKey]
          ),
        },
      },
    };
  }

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
  
  let nextRound = round;
  
  // Module Delta: Track pass while holding hazard marker
  if (state.modules.warpDriveSpool?.enabled && round.hazardMarkerHolder === playerId) {
    nextRound = {
      ...nextRound,
      hazardMarkerPassCount: (nextRound.hazardMarkerPassCount ?? 0) + 1,
    };
  }
  
  nextRound = maybeEndBlockedRound(advanceTurn(nextRound, state.houseRules), state.houseRules);
  return { ok: true, state: withRound(state, nextRound) };
}

function handleDeployBeacon(
  state: GameState,
  round: RoundState,
  playerId: string,
  options?: { afterDraw?: boolean }
): ActionResult {
  const trailKey = trailKeyFor(round, playerId);
  if (round.table.warpTrails[trailKey]?.distressBeacon.active) {
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

  const trail = round.table.warpTrails[trailKey];
  let continuumEffects = round.continuumEffects;
  let redAlert = round.table.redAlert;
  if (redAlert?.responsiblePlayerId === playerId) {
    const advanced = advanceToNextPlayer(round, playerId);
    continuumEffects = advanced.continuumEffects;
    redAlert = {
      ...redAlert,
      responsiblePlayerId: advanced.nextId,
      passed: true,
    };
  }
  let nextRound = updateTable(round, {
    ...round.table,
    warpTrails: {
      ...round.table.warpTrails,
      [trailKey]: deployBeaconOnTrail(trail),
    },
    redAlert,
  });
  nextRound = { ...nextRound, continuumEffects };

  // A forced marker (stuck after drawing) always ends the turn. Under manual
  // shield control a *voluntary* open keeps the turn open for the rest of your
  // play, but consumes your one shield change for the turn.
  const forced = options?.afterDraw === true;
  if (!state.houseRules.manualShieldControl || forced) {
    nextRound = advanceTurn(nextRound, state.houseRules);
    nextRound = maybeEndBlockedRound(nextRound, state.houseRules);
  } else {
    nextRound = { ...nextRound, shieldChangedThisTurn: true };
  }
  return { ok: true, state: withRound(state, nextRound) };
}

function handleRaiseShields(
  state: GameState,
  round: RoundState,
  playerId: string
): ActionResult {
  if (!canRaiseShieldsManually(round, playerId, state.houseRules)) {
    return fail('RAISE_SHIELDS_NOT_ALLOWED');
  }
  const trailKey = trailKeyFor(round, playerId);
  const trail = round.table.warpTrails[trailKey];
  const nextRound: RoundState = {
    ...updateTable(round, {
      ...round.table,
      warpTrails: {
        ...round.table.warpTrails,
        [trailKey]: clearDistressBeacon(trail),
      },
    }),
    shieldChangedThisTurn: true,
  };
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

  // The caught captain drew back up from impulse — return to warp.
  const nextRound = maybeEndBlockedRound(
    { ...penalized, returnedToWarp: true },
    state.houseRules
  );
  return { ok: true, state: withRound(state, nextRound) };
}

function qResolutionBlocksAction(
  round: RoundState,
  playerId: string
): boolean {
  return (
    round.continuumPendingInvoker === playerId ||
    round.continuumWagerPending?.playerId === playerId
  );
}

function handleQFlash(
  state: GameState,
  round: RoundState,
  playerId: string,
  effectKind: FlashEffectKind
): ActionResult {
  if (!state.modules.continuum.enabled) {
    return fail('INVALID_ROUTE');
  }

  if (round.continuumPendingInvoker !== playerId) {
    return fail('CONTINUUM_FLASH_NOT_PENDING');
  }

  const effect = buildQFlashEffect(effectKind, state, round, playerId);
  if (!effect) {
    return fail('CONTINUUM_FLASH_UNAVAILABLE');
  }

  const { round: afterEffect } = applyQFlashEffect(round, effect, playerId);
  let nextRound = finalizeRoundWinAfterQ(afterEffect, state.houseRules);

  const flash: QFlash = { invokedBy: playerId, effect };
  let nextState: GameState = {
    ...state,
    modules: {
      ...state.modules,
      continuum: {
        ...state.modules.continuum,
        activeFlash: flash,
      },
    },
    round: nextRound,
  };

  if (nextRound.phase === 'ended') {
    return { ok: true, state: nextState };
  }

  if (
    !nextRound.continuumWagerPending &&
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
  if (!state.modules.continuum.enabled) {
    return fail('INVALID_ROUTE');
  }

  if (round.continuumWagerPending?.playerId !== playerId) {
    return fail('CONTINUUM_WAGER_NOT_PENDING');
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

/**
 * Handle a draft pick: move coordinate from pack to hand, rotate packs,
 * advance drafter. If draft completes, transition to playing phase.
 */
function handleDraftPick(
  state: GameState,
  round: RoundState,
  playerId: string,
  coordinate: Coordinate
): ActionResult {
  if (!round.draftState) {
    return fail('MODULE_NOT_ENABLED');
  }

  // Process the pick
  const newDraftState = processDraftPick(
    round.draftState,
    playerId,
    coordinate
  );

  // Check if draft is complete
  if (isDraftComplete(newDraftState)) {
    // Transition to playing phase
    const finalHands: Record<string, readonly Coordinate[]> = {};
    round.turnOrder.forEach((id) => {
      finalHands[id] = newDraftState.pickedTiles[id] || [];
    });

    // Collect remaining tiles to uncharted
    const remaining = collectRemainingTiles(newDraftState);

    // Set activePlayerId to spacedock holder (standard game start)
    const spacedockHolder = round.table.spacedock.placedBy;

    const playingRound: RoundState = {
      ...round,
      phase: 'playing',
      activePlayerId: spacedockHolder,
      draftState: null,
      hands: finalHands,
      unchartedSectors: [...round.unchartedSectors, ...remaining],
    };

    // Module Gamma: seed the face-up Sensor Grid now that the draft has resolved
    // and the final Uncharted pile is settled. startGame deliberately skips this
    // on the drafting branch (the pile isn't known until picks finish), so this
    // is the only place a Gamma+Epsilon round gets its grid.
    const nextRound = applySensorGridToRound(playingRound, state.modules);

    return { ok: true, state: withRound(state, nextRound) };
  }

  // Draft continues
  const nextRound: RoundState = {
    ...round,
    activePlayerId: newDraftState.currentDrafter,
    draftState: newDraftState,
  };

  return { ok: true, state: withRound(state, nextRound) };
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  // Clear the transient return-to-warp signal from the prior action so it is
  // only ever true on the state produced by the draw that caused it.
  if (state.round?.returnedToWarp) {
    state = { ...state, round: { ...state.round, returnedToWarp: false } };
  }
  // Same pulse pattern for Module Lambda sound / log cue.
  if (state.round?.wormholeOpened) {
    state = { ...state, round: { ...state.round, wormholeOpened: false } };
  }

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

  // PICK_FROM_PACK is valid during 'drafting' phase, handle it before requireActiveRound
  if (action.type === 'PICK_FROM_PACK') {
    if (state.phase !== 'active' || !state.round) {
      return fail('GAME_NOT_ACTIVE');
    }
    const round = state.round;
    
    if (round.phase !== 'drafting') {
      return fail('ROUND_NOT_DRAFTING');
    }

    if (!round.draftState) {
      return fail('MODULE_NOT_ENABLED');
    }

    if (round.draftState.currentDrafter !== action.playerId) {
      return fail('NOT_YOUR_TURN');
    }

    const pack = round.draftState.currentPacks[action.playerId];
    if (!pack) {
      return fail('COORDINATE_NOT_IN_PACK');
    }

    if (!handContains(pack, action.coordinate)) {
      return fail('COORDINATE_NOT_IN_PACK');
    }

    return handleDraftPick(state, round, action.playerId, action.coordinate);
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
        return fail('CONTINUUM_FLASH_NOT_PENDING');
      }

      if (
        isDropToImpulseAnnouncePending(round, action.playerId, state.houseRules)
      ) {
        return fail('DROP_TO_IMPULSE_CHART_BLOCKED');
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
        !sameTrailGroup(round, action.playerId, action.route.playerId) &&
        !trailsOpenToOthers(round, action.route.playerId)
      ) {
        return fail('SHIELDS_UP');
      }

      const fractureActive = isNavigationHaltedByFracture(
        round.table.subspaceFracture,
        round.table.redAlert
      );
      const redAlertBlocking = isRedAlertBlocking(
        round.table.redAlert,
        action.playerId
      );
      if (
        routineChartsBlockedByManualShieldWindow(
          round,
          action.playerId,
          state.houseRules,
          { fractureActive, redAlertBlocking }
        )
      ) {
        return fail('TURN_CHART_LIMIT');
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
          qContinuumEnabled: state.modules.continuum.enabled,
          houseRules: state.houseRules,
          maxPip: state.maxPip ?? state.round?.maxPip ?? 12,
          modules: state.modules,
        });
        
        // Module Delta: Transfer hazard marker when playing to Neutral Zone
        if (state.modules.warpDriveSpool?.enabled && action.route.kind === 'neutral-zone') {
          round = {
            ...round,
            hazardMarkerHolder: action.playerId,
            hazardMarkerPassCount: 0, // Reset pass count on transfer
          };
        }
        
        // Module Iota: Double Down - next player draws tiles when double is played
        if (state.modules.doubleDown?.enabled && isDouble(action.coordinate)) {
          const drawCount = state.modules.doubleDown.drawCount ?? 2;
          const { nextId } = advanceToNextPlayer(round, action.playerId);
          
          // Draw from uncharted first, then sensor grid if available
          const availableToDraw: Coordinate[] = [];
          let remainingUncharted = [...round.unchartedSectors];
          let remainingSensorGrid: Coordinate[] | null = round.sensorGrid ? [...round.sensorGrid] : null;
          
          for (let i = 0; i < drawCount; i += 1) {
            if (remainingUncharted.length > 0) {
              const drawn = remainingUncharted.shift()!;
              availableToDraw.push(drawn);
            } else if (remainingSensorGrid && remainingSensorGrid.length > 0) {
              const drawn = remainingSensorGrid.shift()!;
              availableToDraw.push(drawn);
            } else {
              break; // No more tiles available
            }
          }
          
          if (availableToDraw.length > 0) {
            round = {
              ...round,
              unchartedSectors: remainingUncharted,
              sensorGrid: remainingSensorGrid ?? [],
              hands: {
                ...round.hands,
                [nextId]: [...(round.hands[nextId] ?? []), ...availableToDraw],
              },
            };
          }
        }
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
        return fail('CONTINUUM_FLASH_NOT_PENDING');
      }
      if (!canDrawFromUncharted(round, action.playerId, state.houseRules)) {
        return fail('DRAW_NOT_ALLOWED');
      }
      return handleDraw(state, round, action.playerId);
    }

    case 'SENSOR_SWEEP': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('CONTINUUM_FLASH_NOT_PENDING');
      }
      if (!canSensorSweep(state.modules, round, action.playerId, state.houseRules)) {
        return fail('DRAW_NOT_ALLOWED');
      }
      return handleSensorSweep(state, round, action.playerId, action.coordinate);
    }

    case 'SPOOL_WARP_DRIVE': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('CONTINUUM_FLASH_NOT_PENDING');
      }
      // Module Delta only — Theta is longest-trail scoring, not spool.
      if (!state.modules.warpDriveSpool?.enabled) {
        return fail('MODULE_NOT_ENABLED');
      }
      // Can't spool with empty uncharted sectors
      if (round.unchartedSectors.length === 0) {
        return fail('EMPTY_UNCHARTED');
      }
      if (
        isDropToImpulseAnnouncePending(round, action.playerId, state.houseRules)
      ) {
        return fail('DROP_TO_IMPULSE_CHART_BLOCKED');
      }
      // Can't spool during fracture or Red Alert - these require specific handling
      if (
        isNavigationHaltedByFracture(
          round.table.subspaceFracture,
          round.table.redAlert
        )
      ) {
        return fail('FRACTURE_REQUIRES_STABILIZER');
      }
      if (isRedAlertBlocking(round.table.redAlert, action.playerId)) {
        return fail('RED_ALERT_REQUIRED');
      }
      return handleWarpDriveSpool(state, round, action.playerId, action.route);
    }

    case 'PASS_RED_ALERT': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('CONTINUUM_FLASH_NOT_PENDING');
      }
      return handlePassRedAlert(state, round, action.playerId);
    }

    case 'PASS_TURN': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('CONTINUUM_FLASH_NOT_PENDING');
      }
      return handlePassTurn(state, round, action.playerId);
    }

    case 'DEPLOY_DISTRESS_BEACON': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('CONTINUUM_FLASH_NOT_PENDING');
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

    case 'RAISE_SHIELDS': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      if (qResolutionBlocksAction(round, action.playerId)) {
        return fail('CONTINUUM_FLASH_NOT_PENDING');
      }
      return handleRaiseShields(state, round, action.playerId);
    }

    case 'INVOKE_CONTINUUM_FLASH': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      return handleQFlash(state, round, action.playerId, action.effect);
    }

    case 'RESOLVE_CONTINUUM_WAGER': {
      const turnCheck = requirePlayerTurn(round, action.playerId);
      if (turnCheck !== true) {
        return fail(turnCheck);
      }
      return handleQGamble(state, round, action.playerId, action.keepIndex);
    }

    case 'SALAMANDER_PENALTY':
    case 'LONGEST_TRAIL_BONUS':
    case 'TEMPORAL_DEBT_PENALTY':
      // Scoring annotations for logs only — never legal play actions.
      return fail('PASS_NOT_ALLOWED');

    default:
      return fail('INVALID_ROUTE');
  }
}

export { getLegalMoves, advanceTurn };
