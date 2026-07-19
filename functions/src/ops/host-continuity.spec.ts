import { describe, expect, it } from 'vitest';

import {
  omitUndefinedFields,
  pickHumanHost,
  remapPlayerInRound,
} from './host-continuity-helpers.js';

describe('remapPlayerInRound', () => {
  it('does not introduce undefined fields on sparse round docs', () => {
    const next = remapPlayerInRound(
      {
        turnOrder: ['a', 'b'],
        activePlayerId: 'a',
        handCounts: { a: 3, b: 4 },
        table: { warpTrails: [{ trailPlayerId: 'b', tiles: [] }] },
      },
      'b',
      'ai:chen'
    );

    expect(next).not.toBeNull();
    expect(Object.values(next!).every((v) => v !== undefined)).toBe(true);
    expect(next!.hazardMarkerHolder).toBeNull();
    expect(next!.dropToImpulseCallPending).toBeNull();
  });

  it('renames seat ids across turn order, trails, and hand counts', () => {
    const next = remapPlayerInRound(
      {
        turnOrder: ['a', 'b', 'c'],
        activePlayerId: 'b',
        handCounts: { a: 5, b: 4, c: 6 },
        table: {
          warpTrails: [
            { trailPlayerId: 'a', tiles: [] },
            { trailPlayerId: 'b', tiles: [] },
          ],
        },
        continuumEffects: { skipNextTurnFor: ['b'] },
        hazardMarkerHolder: 'b',
        dropToImpulseCallPending: 'b',
        draftState: {
          currentDrafter: 'b',
          draftOrder: ['a', 'b'],
          currentPacks: { a: [], b: [{ low: 1, high: 2 }] },
          pickedTiles: { a: [], b: [] },
        },
      },
      'b',
      'ai:chen'
    );

    expect(next).not.toBeNull();
    expect(next!.turnOrder).toEqual(['a', 'ai:chen', 'c']);
    expect(next!.activePlayerId).toBe('ai:chen');
    expect(next!.handCounts).toEqual({ a: 5, c: 6, 'ai:chen': 4 });
    expect(
      (next!.table as { warpTrails: { trailPlayerId: string }[] }).warpTrails
    ).toEqual([
      { trailPlayerId: 'a', tiles: [] },
      { trailPlayerId: 'ai:chen', tiles: [] },
    ]);
    expect(
      (next!.continuumEffects as { skipNextTurnFor: string[] }).skipNextTurnFor
    ).toEqual(['ai:chen']);
    expect(next!.hazardMarkerHolder).toBe('ai:chen');
    expect(next!.dropToImpulseCallPending).toBe('ai:chen');
    expect(
      (next!.draftState as { currentDrafter: string }).currentDrafter
    ).toBe('ai:chen');
  });
});

describe('omitUndefinedFields', () => {
  it('strips undefined values', () => {
    expect(omitUndefinedFields({ a: 1, b: undefined, c: null })).toEqual({
      a: 1,
      c: null,
    });
  });
});

describe('pickHumanHost', () => {
  it('skips AI seats', () => {
    expect(
      pickHumanHost(
        [
          { id: 'host', isAi: false },
          { id: 'ai:chen', isAi: true },
          { id: 'guest', isAi: false },
        ],
        'host'
      )
    ).toBe('guest');
  });

  it('returns null when no other human remains', () => {
    expect(
      pickHumanHost(
        [
          { id: 'host', isAi: false },
          { id: 'ai:chen', isAi: true },
        ],
        'host'
      )
    ).toBeNull();
  });
});
