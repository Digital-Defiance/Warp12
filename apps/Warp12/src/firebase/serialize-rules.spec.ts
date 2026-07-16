import { describe, expect, it } from 'vitest';
import {
  applyAction,
  resolveHouseRules,
  resolveModules,
  toModuleConfig,
  type GameState,
} from 'warp12-engine';

import { mergeHandsIntoGame, serializePublicGame } from './serialize.js';

describe('serialize round rule fields', () => {
  it('persists mandatoryPlay, pendingRoundWin, and roundBlocked', () => {
    const state = {
      id: 'test',
      phase: 'active',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 0,
      houseRules: resolveHouseRules(),
      captains: [{ id: 'a', displayName: 'A', pointsScore: 0 }],
      modules: resolveModules({
        continuum: false,
        salamanderPenalty: false,
        subspaceFracture: false,
      }),
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'ended',
        activePlayerId: 'a',
        turnOrder: ['a', 'b'],
        hands: { a: [], b: [] },
        unchartedSectors: [],
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        continuumPendingInvoker: null,
        continuumEffects: null,
        continuumWagerPending: null,
        mandatoryPlay: { playerId: 'a', coordinate: { low: 6, high: 12 } },
        pendingRoundWin: { playerId: 'a', routeKind: 'warp-trail' as const },
        roundBlocked: true,
        roundStarterOpening: null,
        roundStarterOpeningResolved: false,
        dropToImpulseCallPending: null,
        dropToImpulseCatchable: null,
        playedThisTurn: false,
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      },
    } satisfies GameState;

    const doc = serializePublicGame(state);

    expect(doc.round?.mandatoryPlay).toEqual({
      playerId: 'a',
      coordinate: { low: 6, high: 12 },
    });
    expect(doc.round?.pendingRoundWin).toEqual({
      playerId: 'a',
      routeKind: 'warp-trail',
    });
    expect(doc.round?.roundBlocked).toBe(true);
  });

  it('persists drop to impulse and manual-shield turn fields through online serialize/merge', () => {
    const state = {
      id: 'test',
      phase: 'active',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 0,
      houseRules: resolveHouseRules({
        manualShieldControl: true,
        dropToImpulseCall: true,
      }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
      modules: resolveModules({
        continuum: false,
        salamanderPenalty: false,
        subspaceFracture: false,
      }),
      round: {
        roundNumber: 1,
        spacedockValue: 6,
        phase: 'playing',
        activePlayerId: 'a',
        turnOrder: ['a', 'b'],
        hands: { a: [{ low: 7, high: 8 }], b: [] },
        unchartedSectors: [{ low: 0, high: 1 }],
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        continuumPendingInvoker: null,
        continuumEffects: null,
        continuumWagerPending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
        roundStarterOpeningResolved: false,
        dropToImpulseCallPending: 'a',
        dropToImpulseCatchable: null,
        playedThisTurn: true,
        table: {
          spacedock: { value: 6, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [
                { coordinate: { low: 6, high: 6 }, index: 0, openValue: 6 },
                { coordinate: { low: 6, high: 7 }, index: 1, openValue: 7 },
              ],
              // Serviced own trail since opening → eligible to raise.
              distressBeacon: { active: true, chartedOwnTrailSinceDown: true },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      },
    } satisfies GameState;

    const doc = serializePublicGame(state);
    expect(doc.round?.dropToImpulseCallPending).toBe('a');
    expect(doc.round?.dropToImpulseCatchable).toBeNull();
    expect(doc.round?.playedThisTurn).toBe(true);

    const merged = mergeHandsIntoGame(doc, {
      a: [{ low: 7, high: 8 }],
      b: [],
    });
    expect(merged.round?.dropToImpulseCallPending).toBe('a');
    expect(merged.round?.playedThisTurn).toBe(true);
    // The manual-shield close gate survives the online round-trip.
    expect(
      merged.round?.table.warpTrails.a.distressBeacon.chartedOwnTrailSinceDown
    ).toBe(true);

    // The one-shield-change-per-turn flag also round-trips.
    const openedDoc = serializePublicGame({
      ...state,
      round: { ...state.round!, shieldChangedThisTurn: true },
    });
    expect(openedDoc.round?.shieldChangedThisTurn).toBe(true);
    expect(
      mergeHandsIntoGame(openedDoc, { a: [{ low: 7, high: 8 }], b: [] }).round
        ?.shieldChangedThisTurn
    ).toBe(true);

    const raised = applyAction(merged, { type: 'RAISE_SHIELDS', playerId: 'a' });
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;
    expect(raised.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
      false
    );
    expect(raised.state.round?.activePlayerId).toBe('a');
  });

  it('persists every house-rule toggle through online serialize/merge', () => {
    const config = resolveHouseRules({
      requireOwnTrailFirst: true,
      neutralZoneAfterAllTrails: true,
      beaconClearsOnAnyPlay: true,
      roundStarterPlaysTwo: true,
      dropToImpulseCall: true,
      dropToImpulseCatchPenalty: 2,
      allStopCeremony: false,
      passRedAlertWithoutDraw: true,
      manualShieldControl: true,
      doubleZeroScore: 25,
      largeFleetHandSize: 11,
    });
    const state = {
      id: 'test',
      phase: 'active',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 0,
      houseRules: config,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
      modules: resolveModules({
        continuum: false,
        salamanderPenalty: false,
        subspaceFracture: false,
      }),
      round: null,
    } satisfies GameState;

    const doc = serializePublicGame(state);
    expect(doc.houseRules).toEqual({
      requireOwnTrailFirst: true,
      neutralZoneAfterAllTrails: true,
      beaconClearsOnAnyPlay: true,
      roundStarterPlaysTwo: true,
      dropToImpulseCall: true,
      dropToImpulseCatchPenalty: 2,
      allStopCeremony: false,
      passRedAlertWithoutDraw: true,
      manualShieldControl: true,
      doubleZeroScore: 25,
      largeFleetHandSize: 11,
    });

    const merged = mergeHandsIntoGame(doc, {});
    expect(merged.houseRules).toEqual(config);
  });
});

describe('serialize red alert passed flag', () => {
  it('round-trips the Yellow alert → passed transition through serialize/merge', () => {
    const state = {
      id: 'test',
      phase: 'active',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 0,
      houseRules: resolveHouseRules({ passRedAlertWithoutDraw: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
      modules: resolveModules({
        continuum: false,
        salamanderPenalty: false,
        subspaceFracture: false,
      }),
      round: {
        roundNumber: 1,
        spacedockValue: 6,
        phase: 'playing',
        activePlayerId: 'a',
        turnOrder: ['a', 'b'],
        hands: { a: [{ low: 1, high: 2 }], b: [] },
        unchartedSectors: [{ low: 3, high: 4 }],
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        continuumPendingInvoker: null,
        continuumEffects: null,
        continuumWagerPending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
        roundStarterOpeningResolved: false,
        dropToImpulseCallPending: null,
        dropToImpulseCatchable: null,
        playedThisTurn: false,
        drewThisTurn: false,
        table: {
          spacedock: { value: 6, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [{ coordinate: { low: 6, high: 6 }, index: 0, openValue: 6 }],
              distressBeacon: { active: false },
            },
            b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: {
            active: true,
            anchor: { coordinate: { low: 6, high: 6 }, index: 0, openValue: 6 },
            responsiblePlayerId: 'a',
            trailPlayerId: 'a',
          },
        },
      },
    } satisfies GameState;

    // Yellow alert phase — passed is not serialized (kept undefined/false).
    expect(serializePublicGame(state).round?.table.redAlert?.passed).toBeUndefined();

    const merged = mergeHandsIntoGame(serializePublicGame(state), {
      a: [{ low: 1, high: 2 }],
      b: [],
    });
    const freePass = applyAction(merged, {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(freePass.ok).toBe(true);
    if (!freePass.ok) return;
    expect(freePass.state.round?.table.redAlert?.passed).toBe(true);

    // The passed flag survives a serialize/merge round-trip so online clients
    // (and the reload path) keep enforcing standard rules after the free pass.
    const rehydrated = mergeHandsIntoGame(
      serializePublicGame(freePass.state),
      { a: [], b: [] }
    );
    expect(rehydrated.round?.table.redAlert?.passed).toBe(true);
  });

  it('round-trips all GameModuleConfig flags through serialize/merge', () => {
    const config = {
      continuum: true,
      salamanderPenalty: true,
      sensorGrid: true,
      warpDriveSpool: true,
      drafting: true,
      squadrons: true,
      squadronSize: 2,
      longestTrail: true,
      doubleDown: true,
      temporalDebt: true,
      temporalInversion: true,
      wormholes: true,
      subspaceFracture: true,
      subspaceFractureScope: 'all-captains' as const,
    };
    const state = {
      id: 'mods',
      phase: 'lobby',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 0,
      houseRules: resolveHouseRules(),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, squadronId: 's1' },
        { id: 'b', displayName: 'B', pointsScore: 0, squadronId: 's1' },
        { id: 'c', displayName: 'C', pointsScore: 0, squadronId: 's2' },
        { id: 'd', displayName: 'D', pointsScore: 0, squadronId: 's2' },
      ],
      squadrons: [
        { id: 's1', memberIds: ['a', 'b'], trailKey: 'a', name: 'Alpha' },
        { id: 's2', memberIds: ['c', 'd'], trailKey: 'c' },
      ],
      modules: resolveModules(config),
      round: null,
    } satisfies GameState;

    const doc = serializePublicGame(state);
    expect(doc.modules).toMatchObject({
      drafting: true,
      squadrons: true,
      temporalInversion: true,
      wormholes: true,
      doubleDown: true,
      subspaceFractureScope: 'all-captains',
    });
    expect(doc.squadrons?.[0]).toMatchObject({
      id: 's1',
      trailKey: 'a',
      name: 'Alpha',
    });

    const merged = mergeHandsIntoGame(doc, {});
    expect(toModuleConfig(merged.modules)).toMatchObject({
      drafting: true,
      squadrons: true,
      temporalInversion: true,
      wormholes: true,
      sensorGrid: true,
      warpDriveSpool: true,
    });
    expect(merged.squadrons?.[0]?.trailKey).toBe('a');
    expect(merged.captains[0]?.squadronId).toBe('s1');
  });

  it('round-trips Gamma/Delta/Epsilon/Eta/Zeta round fields', () => {
    const state = {
      id: 'round-mods',
      phase: 'active',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 0,
      houseRules: resolveHouseRules(),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, squadronId: 's1' },
        { id: 'b', displayName: 'B', pointsScore: 0, squadronId: 's1' },
        { id: 'c', displayName: 'C', pointsScore: 0, squadronId: 's2' },
        { id: 'd', displayName: 'D', pointsScore: 0, squadronId: 's2' },
      ],
      squadrons: [
        { id: 's1', memberIds: ['a', 'b'], trailKey: 'a' },
        { id: 's2', memberIds: ['c', 'd'], trailKey: 'c' },
      ],
      modules: resolveModules({
        sensorGrid: true,
        warpDriveSpool: true,
        drafting: true,
        temporalDebt: true,
        squadrons: true,
        squadronSize: 2,
      }),
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'drafting',
        activePlayerId: 'a',
        turnOrder: ['a', 'c', 'b', 'd'],
        hands: { a: [], b: [], c: [], d: [] },
        unchartedSectors: [{ low: 0, high: 1 }],
        sensorGrid: [
          { low: 2, high: 3 },
          { low: 4, high: 5 },
        ],
        draftState: {
          currentDrafter: 'a',
          draftOrder: ['a', 'c', 'b', 'd'],
          pickNumber: 2,
          currentPacks: {
            a: [{ low: 6, high: 7 }],
            b: [{ low: 8, high: 9 }],
            c: [{ low: 1, high: 1 }],
            d: [{ low: 0, high: 0 }],
          },
          pickedTiles: {
            a: [{ low: 3, high: 3 }],
            b: [],
            c: [],
            d: [],
          },
        },
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        continuumPendingInvoker: null,
        continuumEffects: null,
        continuumWagerPending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
        roundStarterOpeningResolved: false,
        dropToImpulseCallPending: null,
        dropToImpulseCatchable: null,
        playedThisTurn: false,
        drewThisTurn: false,
        wormholeOpened: true,
        hazardMarkerHolder: 'a',
        hazardMarkerPassCount: 2,
        debtTokens: { a: 1, b: 0, c: 3, d: 0 },
        squadrons: [
          { id: 's1', memberIds: ['a', 'b'], trailKey: 'a' },
          { id: 's2', memberIds: ['c', 'd'], trailKey: 'c' },
        ],
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: false },
            },
            c: {
              playerId: 'c',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      },
    } satisfies GameState;

    const doc = serializePublicGame(state);
    expect(doc.round?.sensorGrid).toEqual([
      { low: 2, high: 3 },
      { low: 4, high: 5 },
    ]);
    expect(doc.round?.draftState?.currentDrafter).toBe('a');
    expect(doc.round?.draftState?.pickedTiles.a).toEqual([{ low: 3, high: 3 }]);
    expect(doc.round?.hazardMarkerHolder).toBe('a');
    expect(doc.round?.hazardMarkerPassCount).toBe(2);
    expect(doc.round?.debtTokens).toEqual({ a: 1, b: 0, c: 3, d: 0 });
    expect(doc.round?.wormholeOpened).toBe(true);
    expect(doc.round?.squadrons?.[0]?.trailKey).toBe('a');

    const merged = mergeHandsIntoGame(doc, {});
    expect(merged.round?.sensorGrid).toHaveLength(2);
    expect(merged.round?.draftState?.pickNumber).toBe(2);
    expect(merged.round?.draftState?.currentPacks.a).toEqual([
      { low: 6, high: 7 },
    ]);
    expect(merged.round?.hazardMarkerPassCount).toBe(2);
    expect(merged.round?.debtTokens?.c).toBe(3);
    expect(merged.round?.wormholeOpened).toBe(true);
    expect(merged.round?.squadrons?.[1]?.trailKey).toBe('c');
  });
});
