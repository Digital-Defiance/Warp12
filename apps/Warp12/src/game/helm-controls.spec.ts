import { describe, expect, it } from 'vitest';
import { resolveHouseRules } from 'warp12-engine';

import { makeRound, T } from '../../../../libs/engine/src/lib/engine/test-helpers.js';
import { createInitialTable } from '../../../../libs/engine/src/lib/table/table-state.js';
import { resolveHelmControls } from './helm-controls.js';

const manual = resolveHouseRules({ manualShieldControl: true });

describe('resolveHelmControls', () => {
  it('shows no controls when it is not your turn', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'b',
      hands: { a: [T(6, 7)], b: [] },
    });
    expect(
      resolveHelmControls({
        round,
        handOwnerId: 'a',
        isMyTurn: false,
        houseRules: manual,
        dropToImpulsePending: false,
        legalMovesCount: 1,
      })
    ).toEqual({
      showDraw: false,
      showShieldsDown: false,
      showShieldsUp: false,
      showPassRedAlert: false,
      showPass: false,
      spoolOptions: [],
    });
  });

  it('offers shields down and pass after a chart under manual shield control', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      playedThisTurn: true,
      hands: { a: [T(7, 8)], b: [] },
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [
              {
                coordinate: T(6, 6),
                index: 0,
                openValue: 6,
              },
              {
                coordinate: T(6, 7),
                index: 1,
                openValue: 7,
              },
            ],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
      },
    });

    expect(
      resolveHelmControls({
        round,
        handOwnerId: 'a',
        isMyTurn: true,
        houseRules: manual,
        dropToImpulsePending: false,
        legalMovesCount: 1,
      })
    ).toEqual({
      showDraw: false,
      showShieldsDown: true,
      showShieldsUp: false,
      showPassRedAlert: false,
      showPass: true,
      spoolOptions: [],
    });
  });

  it('after a chart, offers pass (not draw) even when no tile can follow (regression)', () => {
    // Reported bug: manual shield control, charted this turn, remaining tile is
    // unplayable → a second routine chart is blocked so legal moves are empty,
    // but Draw must NOT be offered and Pass MUST be available.
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      playedThisTurn: true,
      hands: { a: [T(1, 2)], b: [] },
      unchartedSectors: [T(0, 1)],
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [
              { coordinate: T(6, 6), index: 0, openValue: 6 },
              { coordinate: T(6, 7), index: 1, openValue: 7 },
            ],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
      },
    });

    expect(
      resolveHelmControls({
        round,
        handOwnerId: 'a',
        isMyTurn: true,
        houseRules: manual,
        dropToImpulsePending: false,
        legalMovesCount: 0,
      })
    ).toEqual({
      showDraw: false,
      showShieldsDown: true,
      showShieldsUp: false,
      showPassRedAlert: false,
      showPass: true,
      spoolOptions: [],
    });
  });

  it('shows pass while at impulse so captains can skip the announce', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      dropToImpulseCallPending: 'a',
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [T(0, 1)],
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [{ coordinate: T(12, 3), index: 0, openValue: 3 }],
            distressBeacon: { active: true },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
      },
    });

    expect(
      resolveHelmControls({
        round,
        handOwnerId: 'a',
        isMyTurn: true,
        houseRules: resolveHouseRules({ dropToImpulseCall: true }),
        dropToImpulsePending: true,
        legalMovesCount: 1,
      }).showPass
    ).toBe(true);
  });

  it('shows pass red alert when the house rule allows passing without drawing', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      hands: { a: [T(1, 2)], b: [] },
      unchartedSectors: [T(3, 4)],
      table: {
        ...createInitialTable(['a', 'b'], 6, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        redAlert: {
          active: true,
          anchor: { coordinate: T(6, 6), index: 0, openValue: 6 },
          responsiblePlayerId: 'a',
          trailPlayerId: 'a',
        },
      },
    });

    expect(
      resolveHelmControls({
        round,
        handOwnerId: 'a',
        isMyTurn: true,
        houseRules: resolveHouseRules({ passRedAlertWithoutDraw: true }),
        dropToImpulsePending: false,
        legalMovesCount: 0,
      }).showPassRedAlert
    ).toBe(true);
  });
});
