import { describe, expect, it } from 'vitest';

import {
  AI_OPPONENT_TEI_POINTS,
  opponentTeiForObjective,
  DEFAULT_UNASSISTED_TEI,
  expectedEloScore,
  isProvisionalTei,
  PROVISIONAL_TEI_MATCHES,
  rankCompetition,
  updateTeiHeadToHead,
  updateTeiMultiplayerPairwise,
  updateTeiScore,
  updateUnassistedTei,
} from './stats-elo.js';

describe('stats-elo', () => {
  it('expects even matchups near 0.5', () => {
    expect(expectedEloScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it('raises TEI after beating a higher-rated opponent', () => {
    const next = updateUnassistedTei(
      DEFAULT_UNASSISTED_TEI,
      AI_OPPONENT_TEI_POINTS.commander,
      1,
      32
    );
    expect(next).toBeGreaterThan(DEFAULT_UNASSISTED_TEI);
  });

  it('uses v2 Class II commander anchor by default', () => {
    expect(AI_OPPONENT_TEI_POINTS.commander).toBe(1520);
    expect(opponentTeiForObjective('points', 'commander')).toBe(1520);
    expect(opponentTeiForObjective('go-out', 'commander')).toBe(1550);
    expect(opponentTeiForObjective('points', 'commander', 'warp12-official-v1')).toBe(
      1400
    );
  });

  it('lowers TEI after losing to a lower-rated opponent', () => {
    const next = updateUnassistedTei(
      DEFAULT_UNASSISTED_TEI,
      AI_OPPONENT_TEI_POINTS.ensign,
      0,
      32
    );
    expect(next).toBeLessThan(DEFAULT_UNASSISTED_TEI);
  });

  it('flags a bucket as provisional only between 1 and the threshold', () => {
    expect(isProvisionalTei(0)).toBe(false);
    expect(isProvisionalTei(1)).toBe(true);
    expect(isProvisionalTei(PROVISIONAL_TEI_MATCHES - 1)).toBe(true);
    expect(isProvisionalTei(PROVISIONAL_TEI_MATCHES)).toBe(false);
    expect(isProvisionalTei(PROVISIONAL_TEI_MATCHES + 5)).toBe(false);
  });
});

describe('TEI spec conformance vectors', () => {
  it('§8.2 head-to-head reference updates (v1 profile)', () => {
    expect(updateTeiScore(1000, 1400, 1, 32)).toBe(1029);
    expect(updateTeiScore(1000, 1000, 0, 32)).toBe(984);
  });

  it('§8.2 head-to-head reference updates (v2 Class II Ω)', () => {
    expect(updateTeiScore(1000, 1520, 1, 32)).toBe(1030);
  });

  it('§8.3 three-player pairwise update', () => {
    const table = [
      { playerId: 'a', rank: 1, tei: 1200, unassistedMatches: 15 },
      { playerId: 'b', rank: 2, tei: 1200, unassistedMatches: 15 },
      { playerId: 'c', rank: 3, tei: 1000, unassistedMatches: 15 },
    ];

    expect(updateTeiMultiplayerPairwise(table[0]!, table)).toBe(1212);
    expect(updateTeiMultiplayerPairwise(table[1]!, table)).toBe(1196);
    expect(updateTeiMultiplayerPairwise(table[2]!, table)).toBe(992);
  });

  it('§5.2 competition ranks with ties', () => {
    expect(
      rankCompetition(
        [
          { playerId: 'a', score: 10 },
          { playerId: 'b', score: 12 },
          { playerId: 'c', score: 12 },
          { playerId: 'd', score: 20 },
        ],
        true
      )
    ).toEqual(
      new Map([
        ['a', 1],
        ['b', 2],
        ['c', 2],
        ['d', 4],
      ])
    );
  });

  it('head-to-head helper matches updateTeiScore', () => {
    expect(updateTeiHeadToHead(1000, 1400, true, 15)).toBe(1029);
  });
});
