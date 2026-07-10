import { describe, expect, it } from 'vitest';

import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import {
  handSizeForPlayerCount,
  spacedockValueForRound,
  warpSetProfile,
} from './setup.js';
import { startGame } from '../setup/create-game.js';
import { checkRoundInvariants } from '../engine/engine-invariants.js';

describe('warp set profiles', () => {
  it('defines double-9 through double-18 campaigns', () => {
    expect(warpSetProfile(9).campaignRounds).toBe(10);
    expect(warpSetProfile(12).campaignRounds).toBe(13);
    expect(warpSetProfile(15).tileCount).toBe(136);
    expect(warpSetProfile(18).tileCount).toBe(190);
  });

  it('deals a Warp 9 sector with 9-9 Spacedock and compact hands', () => {
    expect(handSizeForPlayerCount(4, 10, 9)).toBe(7);
    expect(spacedockValueForRound(1, 9)).toBe(9);
    expect(spacedockValueForRound(10, 9)).toBe(0);

    const shuffled = shuffleCoordinates(generateCoordinateSet(9), () => 0.5);
    const state = startGame(
      {
        id: 'warp9',
        captains: [
          { id: 'a', displayName: 'A' },
          { id: 'b', displayName: 'B' },
          { id: 'c', displayName: 'C' },
          { id: 'd', displayName: 'D' },
        ],
        maxPip: 9,
      },
      { shuffledCoordinates: shuffled, roundStarterId: 'a' }
    );

    expect(state.maxPip).toBe(9);
    expect(state.campaignRounds).toBe(10);
    expect(state.round?.spacedockValue).toBe(9);
    expect(state.round?.hands.a).toHaveLength(7);
  });

  it('deals a Warp 18 sector and conserves the 190-tile set', () => {
    expect(warpSetProfile(18).maxPlayers).toBe(18);
    expect(handSizeForPlayerCount(18, 10, 18)).toBe(6);

    const shuffled = shuffleCoordinates(generateCoordinateSet(18), () => 0.5);
    const captains = Array.from({ length: 4 }, (_, index) => ({
      id: `c${index}`,
      displayName: `C${index}`,
    }));
    const state = startGame(
      {
        id: 'warp18',
        captains,
        maxPip: 18,
      },
      { shuffledCoordinates: shuffled, roundStarterId: 'c0' }
    );

    expect(state.maxPip).toBe(18);
    expect(state.campaignRounds).toBe(19);
    expect(state.round?.spacedockValue).toBe(18);
    expect(checkRoundInvariants(state, state.round!)).toEqual([]);
  });
});
