import type {
  GameAction,
  GameState,
  QFlashEffectKind,
  RoundState,
} from 'warp12-engine';
import { resolveHouseRules } from 'warp12-engine';

import type {
  FirestoreCoordinate,
  FirestoreGameDocument,
  FirestorePlacedCoordinate,
  FirestorePublicRound,
  FirestoreTableDocument,
} from './schema.js';
import { ONLINE_MAX_PLAYERS } from './schema.js';

type Coordinate = { low: number; high: number };

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
    modules: {
      qContinuum: state.modules.qContinuum.enabled,
      salamanderPenalty: state.modules.salamanderPenalty.enabled,
      subspaceFracture: state.modules.subspaceFracture.enabled,
      subspaceFractureScope: state.modules.subspaceFracture.scope,
    },
    houseRules: {
      requireOwnTrailFirst: state.houseRules.requireOwnTrailFirst,
      neutralZoneAfterAllTrails: state.houseRules.neutralZoneAfterAllTrails,
      beaconClearsOnAnyPlay: state.houseRules.beaconClearsOnAnyPlay,
      roundStarterPlaysTwo: state.houseRules.roundStarterPlaysTwo,
      dropToImpulseCall: state.houseRules.dropToImpulseCall,
      dropToImpulseCatchPenalty: state.houseRules.dropToImpulseCatchPenalty,
      allStopCeremony: state.houseRules.allStopCeremony,
    },
    objective: state.objective,
    campaignRounds: state.campaignRounds,
    maxPlayers: ONLINE_MAX_PLAYERS,
    captainIds: state.captains.map((c) => c.id),
    captains: state.captains.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      penaltyScore: c.penaltyScore,
      joinedAt: new Date().toISOString(),
    })),
    completedRounds: state.completedRounds,
    round: state.round ? serializePublicRound(state.round) : null,
    qFlash: state.modules.qContinuum.activeFlash
      ? {
          invokedBy: state.modules.qContinuum.activeFlash.invokedBy,
          effect: {
            kind: state.modules.qContinuum.activeFlash.effect.kind,
            ...(state.modules.qContinuum.activeFlash.effect.targetPlayerId
              ? {
                  targetPlayerId:
                    state.modules.qContinuum.activeFlash.effect.targetPlayerId,
                }
              : {}),
            ...(state.modules.qContinuum.activeFlash.effect.peek
              ? {
                  peek: {
                    index: state.modules.qContinuum.activeFlash.effect.peek.index,
                    coordinate: toFirestoreCoordinate(
                      state.modules.qContinuum.activeFlash.effect.peek.coordinate
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
    qPendingInvoker: round.qPendingInvoker ?? null,
    qEffects: round.qEffects
      ? {
          reverseTurnOrder: round.qEffects.reverseTurnOrder,
          temporalInversion: round.qEffects.temporalInversion,
          openAllTrails: round.qEffects.openAllTrails,
          suppressNextFracture: round.qEffects.suppressNextFracture,
          skipNextTurnFor: [...round.qEffects.skipNextTurnFor],
          peekedSector: round.qEffects.peekedSector
            ? {
                index: round.qEffects.peekedSector.index,
                coordinate: toFirestoreCoordinate(
                  round.qEffects.peekedSector.coordinate
                ),
                visibleTo: round.qEffects.peekedSector.visibleTo,
              }
            : null,
          salamanderSwap: round.qEffects.salamanderSwap,
          allStopEcho: round.qEffects.allStopEcho,
        }
      : null,
    qGamblePending: round.qGamblePending
      ? {
          playerId: round.qGamblePending.playerId,
          options: [
            toFirestoreCoordinate(round.qGamblePending.options[0]),
            toFirestoreCoordinate(round.qGamblePending.options[1]),
          ],
        }
      : null,
    roundStarterOpening: round.roundStarterOpening
      ? { playerId: round.roundStarterOpening.playerId }
      : null,
    dropToImpulseCallPending: round.dropToImpulseCallPending ?? null,
    dropToImpulseCatchable: round.dropToImpulseCatchable ?? null,
    table: serializeTable(round),
  };
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
        }
      : null,
  };
}

export function mergeHandsIntoGame(
  doc: FirestoreGameDocument,
  handsByPlayer: Readonly<Record<string, readonly Coordinate[]>>
): GameState {
  const warpTrails: RoundState['table']['warpTrails'] = {};
  const tableDoc = doc.round?.table;

  if (tableDoc) {
    for (const trail of tableDoc.warpTrails) {
      warpTrails[trail.playerId] = {
        playerId: trail.playerId,
        tiles: trail.tiles.map(fromPlaced),
        distressBeacon: { active: trail.distressBeaconActive },
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
        qPendingInvoker: doc.round.qPendingInvoker ?? null,
        qEffects: doc.round.qEffects
          ? {
              reverseTurnOrder: doc.round.qEffects.reverseTurnOrder,
              temporalInversion: doc.round.qEffects.temporalInversion,
              openAllTrails: doc.round.qEffects.openAllTrails,
              suppressNextFracture: doc.round.qEffects.suppressNextFracture,
              skipNextTurnFor: [...doc.round.qEffects.skipNextTurnFor],
              peekedSector: doc.round.qEffects.peekedSector
                ? {
                    index: doc.round.qEffects.peekedSector.index,
                    coordinate: fromFirestoreCoordinate(
                      doc.round.qEffects.peekedSector.coordinate
                    ),
                    visibleTo: doc.round.qEffects.peekedSector.visibleTo,
                  }
                : null,
              salamanderSwap: doc.round.qEffects.salamanderSwap,
              allStopEcho: doc.round.qEffects.allStopEcho,
            }
          : null,
        qGamblePending: doc.round.qGamblePending
          ? {
              playerId: doc.round.qGamblePending.playerId,
              options: [
                fromFirestoreCoordinate(doc.round.qGamblePending.options[0]),
                fromFirestoreCoordinate(doc.round.qGamblePending.options[1]),
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
      penaltyScore: c.penaltyScore,
    })),
    round,
    completedRounds: doc.completedRounds,
    modules: {
      qContinuum: {
        enabled: doc.modules.qContinuum,
        activeFlash: doc.qFlash?.effect
          ? {
              invokedBy: doc.qFlash.invokedBy,
              effect: {
                kind: doc.qFlash.effect.kind as QFlashEffectKind,
                ...(doc.qFlash.effect.targetPlayerId
                  ? { targetPlayerId: doc.qFlash.effect.targetPlayerId }
                  : {}),
                ...(doc.qFlash.effect.peek
                  ? {
                      peek: {
                        index: doc.qFlash.effect.peek.index,
                        coordinate: fromFirestoreCoordinate(
                          doc.qFlash.effect.peek.coordinate
                        ),
                      },
                    }
                  : {}),
              },
            }
          : null,
      },
      salamanderPenalty: {
        enabled: doc.modules.salamanderPenalty,
      },
      subspaceFracture: {
        enabled: doc.modules.subspaceFracture,
        scope: doc.modules.subspaceFractureScope ?? 'own-trail',
      },
    },
    objective: doc.objective,
    campaignRounds: doc.campaignRounds,
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
