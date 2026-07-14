import {
  resolveHouseRules,
  resolveModules,
  toModuleConfig,
} from 'warp12-engine';
import type {
  GameAction,
  GameState,
  FlashEffectKind,
  RoundState,
} from 'warp12-engine';

import type {
  FirestoreCoordinate,
  FirestoreDraftState,
  FirestoreGameDocument,
  FirestorePlacedCoordinate,
  FirestorePublicRound,
  FirestoreSquadron,
  FirestoreTableDocument,
} from './schema.js';
import { ONLINE_MAX_PLAYERS } from './schema.js';

type Coordinate = { low: number; high: number };

function decodeSquadron(s: FirestoreSquadron) {
  return {
    id: s.id,
    memberIds: [...s.memberIds],
    trailKey: s.trailKey ?? s.memberIds[0] ?? s.id,
    ...(s.name ? { name: s.name } : {}),
  };
}

function decodeDraftState(
  draft: FirestoreDraftState | null | undefined
): RoundState['draftState'] {
  if (!draft) {
    return null;
  }
  return {
    currentDrafter: draft.currentDrafter,
    draftOrder: [...draft.draftOrder],
    pickNumber: draft.pickNumber,
    currentPacks: Object.fromEntries(
      Object.entries(draft.currentPacks).map(([id, tiles]) => [
        id,
        tiles.map(fromFirestoreCoordinate),
      ])
    ),
    pickedTiles: Object.fromEntries(
      Object.entries(draft.pickedTiles).map(([id, tiles]) => [
        id,
        tiles.map(fromFirestoreCoordinate),
      ])
    ),
  };
}

export function toFirestoreCoordinate(c: Coordinate): FirestoreCoordinate {
  return { low: c.low, high: c.high };
}

export function fromFirestoreCoordinate(c: FirestoreCoordinate): Coordinate {
  return { low: c.low, high: c.high };
}

function toPlaced(p: {
  coordinate: Coordinate;
  index: number;
  openValue: number;
}): FirestorePlacedCoordinate {
  return {
    coordinate: toFirestoreCoordinate(p.coordinate),
    index: p.index,
    openValue: p.openValue,
  };
}

function fromPlaced(p: FirestorePlacedCoordinate): {
  coordinate: Coordinate;
  index: number;
  openValue: number;
} {
  return {
    coordinate: fromFirestoreCoordinate(p.coordinate),
    index: p.index,
    openValue: p.openValue,
  };
}

export function serializePublicGame(state: GameState): FirestoreGameDocument {
  const now = new Date().toISOString();
  return {
    id: state.id,
    phase: state.phase,
    hostId: '',
    createdAt: now,
    updatedAt: now,
    modules: toModuleConfig(state.modules),
    ...(state.squadrons
      ? {
          squadrons: state.squadrons.map((s) => ({
            id: s.id,
            memberIds: [...s.memberIds],
            trailKey: s.trailKey,
            ...(s.name ? { name: s.name } : {}),
          })),
        }
      : {}),
    houseRules: {
      requireOwnTrailFirst: state.houseRules.requireOwnTrailFirst,
      neutralZoneAfterAllTrails: state.houseRules.neutralZoneAfterAllTrails,
      beaconClearsOnAnyPlay: state.houseRules.beaconClearsOnAnyPlay,
      roundStarterPlaysTwo: state.houseRules.roundStarterPlaysTwo,
      dropToImpulseCall: state.houseRules.dropToImpulseCall,
      dropToImpulseCatchPenalty: state.houseRules.dropToImpulseCatchPenalty,
      allStopCeremony: state.houseRules.allStopCeremony,
      passRedAlertWithoutDraw: state.houseRules.passRedAlertWithoutDraw,
      manualShieldControl: state.houseRules.manualShieldControl,
      doubleZeroScore: state.houseRules.doubleZeroScore,
      largeFleetHandSize: state.houseRules.largeFleetHandSize,
    },
    objective: state.objective,
    campaignRounds: state.campaignRounds,
    maxPip: state.maxPip ?? 12,
    maxPlayers: ONLINE_MAX_PLAYERS,
    captainIds: state.captains.map((c) => c.id),
    captains: state.captains.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      pointsScore: c.pointsScore,
      joinedAt: new Date().toISOString(),
      ...(c.squadronId ? { squadronId: c.squadronId } : {}),
    })),
    completedRounds: state.completedRounds,
    round: state.round ? serializePublicRound(state.round) : null,
    flash: state.modules.continuum.activeFlash
      ? {
          invokedBy: state.modules.continuum.activeFlash.invokedBy,
          effect: {
            kind: state.modules.continuum.activeFlash.effect.kind,
            ...(state.modules.continuum.activeFlash.effect.targetPlayerId
              ? {
                  targetPlayerId:
                    state.modules.continuum.activeFlash.effect.targetPlayerId,
                }
              : {}),
            ...(state.modules.continuum.activeFlash.effect.peek
              ? {
                  peek: {
                    index: state.modules.continuum.activeFlash.effect.peek.index,
                    coordinate: toFirestoreCoordinate(
                      state.modules.continuum.activeFlash.effect.peek.coordinate
                    ),
                  },
                }
              : {}),
          },
        }
      : null,
  };
}

function serializePublicRound(round: RoundState): FirestorePublicRound {
  const handCounts = Object.fromEntries(
    Object.entries(round.hands).map(([id, hand]) => [id, hand.length])
  );

  return {
    roundNumber: round.roundNumber,
    spacedockValue: round.spacedockValue,
    phase: round.phase,
    activePlayerId: round.activePlayerId,
    turnOrder: [...round.turnOrder],
    handCounts,
    unchartedSectors: round.unchartedSectors.map(toFirestoreCoordinate),
    allStopRequired: round.allStopRequired,
    allStopDeclared: round.allStopDeclared,
    roundWinnerId: round.roundWinnerId ?? null,
    roundBlocked: round.roundBlocked,
    mandatoryPlay: round.mandatoryPlay
      ? {
          playerId: round.mandatoryPlay.playerId,
          coordinate: toFirestoreCoordinate(round.mandatoryPlay.coordinate),
        }
      : null,
    pendingRoundWin: round.pendingRoundWin ?? null,
    continuumPendingInvoker: round.continuumPendingInvoker ?? null,
    continuumEffects: round.continuumEffects
      ? {
          reverseTurnOrder: round.continuumEffects.reverseTurnOrder,
          temporalInversion: round.continuumEffects.temporalInversion,
          openAllTrails: round.continuumEffects.openAllTrails,
          suppressNextFracture: round.continuumEffects.suppressNextFracture,
          skipNextTurnFor: [...round.continuumEffects.skipNextTurnFor],
          peekedSector: round.continuumEffects.peekedSector
            ? {
                index: round.continuumEffects.peekedSector.index,
                coordinate: toFirestoreCoordinate(
                  round.continuumEffects.peekedSector.coordinate
                ),
                visibleTo: round.continuumEffects.peekedSector.visibleTo,
              }
            : null,
          salamanderSwap: round.continuumEffects.salamanderSwap,
          allStopEcho: round.continuumEffects.allStopEcho,
        }
      : null,
    continuumWagerPending: round.continuumWagerPending
      ? {
          playerId: round.continuumWagerPending.playerId,
          options: [
            toFirestoreCoordinate(round.continuumWagerPending.options[0]),
            toFirestoreCoordinate(round.continuumWagerPending.options[1]),
          ],
        }
      : null,
    roundStarterOpening: round.roundStarterOpening
      ? { playerId: round.roundStarterOpening.playerId }
      : null,
    dropToImpulseCallPending: round.dropToImpulseCallPending ?? null,
    dropToImpulseCatchable: round.dropToImpulseCatchable ?? null,
    playedThisTurn: round.playedThisTurn ?? false,
    drewThisTurn: round.drewThisTurn ?? false,
    shieldChangedThisTurn: round.shieldChangedThisTurn ?? false,
    ...(round.returnedToWarp ? { returnedToWarp: true } : {}),
    ...(round.wormholeOpened ? { wormholeOpened: true } : {}),
    sensorGrid: (round.sensorGrid ?? []).map(toFirestoreCoordinate),
    draftState: round.draftState
      ? {
          currentDrafter: round.draftState.currentDrafter,
          draftOrder: [...round.draftState.draftOrder],
          pickNumber: round.draftState.pickNumber,
          currentPacks: mapCoordRecord(round.draftState.currentPacks),
          pickedTiles: mapCoordRecord(round.draftState.pickedTiles),
        }
      : null,
    ...(round.hazardMarkerHolder !== undefined
      ? { hazardMarkerHolder: round.hazardMarkerHolder }
      : {}),
    ...(round.hazardMarkerPassCount !== undefined
      ? { hazardMarkerPassCount: round.hazardMarkerPassCount }
      : {}),
    ...(round.debtTokens
      ? { debtTokens: { ...round.debtTokens } }
      : {}),
    ...(round.squadrons
      ? {
          squadrons: round.squadrons.map((s) => ({
            id: s.id,
            memberIds: [...s.memberIds],
            trailKey: s.trailKey,
            ...(s.name ? { name: s.name } : {}),
          })),
        }
      : {}),
    table: serializeTable(round),
  };
}

function mapCoordRecord(
  record: Readonly<Record<string, readonly { low: number; high: number }[]>>
): Record<string, FirestoreCoordinate[]> {
  return Object.fromEntries(
    Object.entries(record).map(([id, tiles]) => [
      id,
      tiles.map(toFirestoreCoordinate),
    ])
  );
}

function serializeTable(round: RoundState): FirestoreTableDocument {
  const { table } = round;
  return {
    spacedock: {
      value: table.spacedock.value,
      placedBy: table.spacedock.placedBy,
    },
    warpTrails: Object.values(table.warpTrails).map((trail) => ({
      playerId: trail.playerId,
      tiles: trail.tiles.map(toPlaced),
      distressBeaconActive: trail.distressBeacon.active,
      ...(trail.distressBeacon.chartedOwnTrailSinceDown
        ? { distressBeaconChartedOwnTrailSinceDown: true }
        : {}),
    })),
    neutralZone: {
      tiles: table.neutralZone.tiles.map(toPlaced),
    },
    subspaceFracture: table.subspaceFracture
      ? {
          active: table.subspaceFracture.active,
          anchor: toPlaced(table.subspaceFracture.anchor),
          stabilizers: table.subspaceFracture.stabilizers.map(toPlaced),
          requiredValue: table.subspaceFracture.requiredValue,
          ...(table.subspaceFracture.neutralZone ? { neutralZone: true } : {}),
          ...(table.subspaceFracture.trailCaptainId
            ? { trailCaptainId: table.subspaceFracture.trailCaptainId }
            : {}),
        }
      : null,
    redAlert: table.redAlert
      ? {
          active: table.redAlert.active,
          anchor: toPlaced(table.redAlert.anchor),
          responsiblePlayerId: table.redAlert.responsiblePlayerId ?? null,
          trailPlayerId: table.redAlert.trailPlayerId,
          ...(table.redAlert.neutralZone ? { neutralZone: true } : {}),
          ...(table.redAlert.passed ? { passed: true } : {}),
        }
      : null,
  };
}

export function mergeHandsIntoGame(
  doc: FirestoreGameDocument,
  handsByPlayer: Readonly<Record<string, readonly Coordinate[]>>
): GameState {
  const warpTrails: Record<
    string,
    {
      playerId: string;
      tiles: ReturnType<typeof fromPlaced>[];
      distressBeacon: {
        active: boolean;
        chartedOwnTrailSinceDown?: boolean;
      };
    }
  > = {};
  const tableDoc = doc.round?.table;

  if (tableDoc) {
    for (const trail of tableDoc.warpTrails) {
      warpTrails[trail.playerId] = {
        playerId: trail.playerId,
        tiles: trail.tiles.map(fromPlaced),
        distressBeacon: {
          active: trail.distressBeaconActive,
          ...(trail.distressBeaconChartedOwnTrailSinceDown
            ? { chartedOwnTrailSinceDown: true }
            : {}),
        },
      };
    }
  }

  const round: RoundState | null = doc.round
    ? {
        roundNumber: doc.round.roundNumber,
        spacedockValue: doc.round.spacedockValue,
        phase: doc.round.phase,
        activePlayerId: doc.round.activePlayerId,
        turnOrder: doc.round.turnOrder,
        hands: Object.fromEntries(
          doc.round.turnOrder.map((id) => [
            id,
            [...(handsByPlayer[id] ?? [])],
          ])
        ),
        unchartedSectors: doc.round.unchartedSectors.map(fromFirestoreCoordinate),
        allStopRequired: doc.round.allStopRequired,
        allStopDeclared: doc.round.allStopDeclared,
        roundWinnerId: doc.round.roundWinnerId ?? null,
        continuumPendingInvoker: doc.round.continuumPendingInvoker ?? null,
        continuumEffects: doc.round.continuumEffects
          ? {
              reverseTurnOrder: doc.round.continuumEffects.reverseTurnOrder,
              temporalInversion: doc.round.continuumEffects.temporalInversion,
              openAllTrails: doc.round.continuumEffects.openAllTrails,
              suppressNextFracture: doc.round.continuumEffects.suppressNextFracture,
              skipNextTurnFor: [...doc.round.continuumEffects.skipNextTurnFor],
              peekedSector: doc.round.continuumEffects.peekedSector
                ? {
                    index: doc.round.continuumEffects.peekedSector.index,
                    coordinate: fromFirestoreCoordinate(
                      doc.round.continuumEffects.peekedSector.coordinate
                    ),
                    visibleTo: doc.round.continuumEffects.peekedSector.visibleTo,
                  }
                : null,
              salamanderSwap: doc.round.continuumEffects.salamanderSwap,
              allStopEcho: doc.round.continuumEffects.allStopEcho,
            }
          : null,
        continuumWagerPending: doc.round.continuumWagerPending
          ? {
              playerId: doc.round.continuumWagerPending.playerId,
              options: [
                fromFirestoreCoordinate(doc.round.continuumWagerPending.options[0]),
                fromFirestoreCoordinate(doc.round.continuumWagerPending.options[1]),
              ],
            }
          : null,
        mandatoryPlay: doc.round.mandatoryPlay
          ? {
              playerId: doc.round.mandatoryPlay.playerId,
              coordinate: fromFirestoreCoordinate(
                doc.round.mandatoryPlay.coordinate
              ),
            }
          : null,
        pendingRoundWin: doc.round.pendingRoundWin
          ? {
              playerId: doc.round.pendingRoundWin.playerId,
              routeKind: doc.round.pendingRoundWin.routeKind as import('warp12-engine').ChartRoute['kind'],
            }
          : null,
        roundBlocked: doc.round.roundBlocked ?? false,
        roundStarterOpening: doc.round.roundStarterOpening ?? null,
        dropToImpulseCallPending: doc.round.dropToImpulseCallPending ?? null,
        dropToImpulseCatchable: doc.round.dropToImpulseCatchable ?? null,
        playedThisTurn: doc.round.playedThisTurn ?? false,
        drewThisTurn: doc.round.drewThisTurn ?? false,
        shieldChangedThisTurn: doc.round.shieldChangedThisTurn ?? false,
        returnedToWarp: doc.round.returnedToWarp === true,
        ...(doc.round.wormholeOpened === true ? { wormholeOpened: true } : {}),
        maxPip: doc.maxPip ?? 12,
        sensorGrid: (doc.round.sensorGrid ?? []).map(fromFirestoreCoordinate),
        draftState: decodeDraftState(doc.round.draftState),
        ...(doc.round.hazardMarkerHolder !== undefined
          ? { hazardMarkerHolder: doc.round.hazardMarkerHolder }
          : {}),
        ...(doc.round.hazardMarkerPassCount !== undefined
          ? { hazardMarkerPassCount: doc.round.hazardMarkerPassCount }
          : {}),
        ...(doc.round.debtTokens
          ? { debtTokens: { ...doc.round.debtTokens } }
          : {}),
        ...(doc.round.squadrons ?? doc.squadrons
          ? {
              squadrons: (doc.round.squadrons ?? doc.squadrons)!.map(
                decodeSquadron
              ),
            }
          : {}),
        table: tableDoc
          ? {
              spacedock: tableDoc.spacedock,
              warpTrails,
              neutralZone: {
                tiles: tableDoc.neutralZone.tiles.map(fromPlaced),
              },
              subspaceFracture: tableDoc.subspaceFracture
                ? {
                    active: tableDoc.subspaceFracture.active,
                    anchor: fromPlaced(tableDoc.subspaceFracture.anchor),
                    stabilizers:
                      tableDoc.subspaceFracture.stabilizers.map(fromPlaced),
                    requiredValue: tableDoc.subspaceFracture.requiredValue,
                    ...(tableDoc.subspaceFracture.neutralZone
                      ? { neutralZone: true }
                      : {}),
                    ...(tableDoc.subspaceFracture.trailCaptainId
                      ? { trailCaptainId: tableDoc.subspaceFracture.trailCaptainId }
                      : {}),
                  }
                : null,
              redAlert: tableDoc.redAlert
                ? {
                    active: tableDoc.redAlert.active,
                    anchor: fromPlaced(tableDoc.redAlert.anchor),
                    responsiblePlayerId: tableDoc.redAlert.responsiblePlayerId,
                    trailPlayerId: tableDoc.redAlert.trailPlayerId,
                    ...(tableDoc.redAlert.neutralZone
                      ? { neutralZone: true }
                      : {}),
                    ...(tableDoc.redAlert.passed ? { passed: true } : {}),
                  }
                : null,
            }
          : {
              spacedock: { value: 12, placedBy: '' },
              warpTrails: {},
              neutralZone: { tiles: [] },
              subspaceFracture: null,
              redAlert: null,
            },
      }
    : null;

  return {
    id: doc.id,
    phase: doc.phase,
    captains: doc.captains.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      pointsScore: c.pointsScore,
      ...(c.squadronId ? { squadronId: c.squadronId } : {}),
    })),
    ...(doc.squadrons
      ? {
          squadrons: doc.squadrons.map(decodeSquadron),
        }
      : {}),
    round,
    completedRounds: doc.completedRounds,
    modules: (() => {
      const resolved = resolveModules(doc.modules ?? {});
      return {
        ...resolved,
        continuum: {
          enabled: resolved.continuum.enabled,
          activeFlash: doc.flash?.effect
            ? {
                invokedBy: doc.flash.invokedBy,
                effect: {
                  kind: doc.flash.effect.kind as FlashEffectKind,
                  ...(doc.flash.effect.targetPlayerId
                    ? { targetPlayerId: doc.flash.effect.targetPlayerId }
                    : {}),
                  ...(doc.flash.effect.peek
                    ? {
                        peek: {
                          index: doc.flash.effect.peek.index,
                          coordinate: fromFirestoreCoordinate(
                            doc.flash.effect.peek.coordinate
                          ),
                        },
                      }
                    : {}),
                },
              }
            : null,
        },
      };
    })(),
    objective: doc.objective,
    campaignRounds: doc.campaignRounds,
    maxPip: doc.maxPip ?? 12,
    houseRules: resolveHouseRules(doc.houseRules),
  };
}

export function extractHands(state: GameState): Record<string, Coordinate[]> {
  if (!state.round) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(state.round.hands).map(([id, hand]) => [id, [...hand]])
  );
}

export type { GameAction };
