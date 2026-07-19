/**
 * Standard Mexican Train conformance suite.
 *
 * Each scenario validates one rule from RULES.md Sections I–V against the
 * authoritative online sources studied for Warp 12. Where reputable sources
 * disagree, the test documents Warp 12's chosen convention and cites the source
 * it follows. Sources (retrieved for verification):
 *
 *  - [W]   Wikipedia, "Mexican Train"  https://en.wikipedia.org/wiki/Mexican_Train
 *  - [MoG] Masters of Games rules       https://www.mastersofgames.com/rules/mexican-train-dominoes-rules.htm
 *  - [UBG] UltraBoardGames official     https://www.ultraboardgames.com/mexican-train/game-rules.php
 *  - [GC]  Game Cabinet (Galt-derived)  http://www.gamecabinet.com/rules/MexicanTrains.html
 *  - [DP]  domino-play.com              http://www.domino-play.com/Games/MexicanTrain.htm
 *  - [MTR] mexicantrainrulesandstrategies.com (tournament PDF)
 *
 * Full source-by-source matrix: docs/mexican-train-rules-sources.md
 */
import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { canDeployDistressBeacon, canDrawFromUncharted } from './beacon.js';
import { getLegalMoves, isLegalMove } from './legal-moves.js';
import { scoreRound } from './scoring.js';
import {
  allTilesWithPip,
  makeGame,
  makeRound,
  placed,
  T,
} from './test-helpers.js';
import {
  isPipExhausted,
  isRedAlertDoubleDead,
} from '../table/pip-inventory.js';
import {
  DOUBLE_EIGHTEEN_SET_SIZE,
  DOUBLE_FIFTEEN_SET_SIZE,
  DOUBLE_NINE_SET_SIZE,
  DOUBLE_TWELVE_SET_SIZE,
  handSizeForPlayerCount,
  spacedockValueForRound,
} from '../constants/setup.js';
import {
  assertCoordinateSetSize,
  expectedCoordinateSetSize,
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { dealRoundFromShuffled } from '../setup/create-game.js';
import {
  coordinateKey,
  coordinatePipValue,
  normalizeCoordinate,
} from '../types/coordinate.js';
import { resolveHouseRules } from '../types/house-rules.js';

const rules = resolveHouseRules({});

// ---------------------------------------------------------------------------
// II. Mission setup
// ---------------------------------------------------------------------------

describe('Setup — the set is a 55-tile double-nine [W][MoG][UBG]', () => {
  it('has 55 unique coordinates in a double 9', () => {
    const set = generateCoordinateSet(9);
    expect(set).toHaveLength(DOUBLE_NINE_SET_SIZE);
    expect(expectedCoordinateSetSize(9)).toBe(DOUBLE_NINE_SET_SIZE);
    expect(DOUBLE_NINE_SET_SIZE).toBe(55);
    // Throws on wrong count or duplicates.
    assertCoordinateSetSize(set, DOUBLE_NINE_SET_SIZE);
  });
});

describe('Setup — the set is a 91-tile double-twelve [W][MoG][UBG]', () => {
  it('has 91 unique coordinates in a double 12', () => {
    const set = generateCoordinateSet(12);
    expect(set).toHaveLength(DOUBLE_TWELVE_SET_SIZE);
    expect(expectedCoordinateSetSize(12)).toBe(DOUBLE_TWELVE_SET_SIZE);
    expect(DOUBLE_TWELVE_SET_SIZE).toBe(91);
    // Throws on wrong count or duplicates.
    assertCoordinateSetSize(set, DOUBLE_TWELVE_SET_SIZE);
  });
});

describe('Setup — the set is a 136-tile double-fifteen [W][MoG][UBG]', () => {
    it('has 136 unique coordinates in a double 15', () => {
    const set = generateCoordinateSet(15);
    expect(set).toHaveLength(DOUBLE_FIFTEEN_SET_SIZE);
    expect(expectedCoordinateSetSize(15)).toBe(DOUBLE_FIFTEEN_SET_SIZE);
    expect(DOUBLE_FIFTEEN_SET_SIZE).toBe(136);
    // Throws on wrong count or duplicates.
    assertCoordinateSetSize(set, DOUBLE_FIFTEEN_SET_SIZE);
  });
});

describe('Setup — the set is a 190-tile double-eighteen [W][MoG][UBG]', () => {
    it('has 190 unique coordinates in a double 18', () => {
    const set = generateCoordinateSet(18);
    expect(set).toHaveLength(DOUBLE_EIGHTEEN_SET_SIZE);
    expect(expectedCoordinateSetSize(18)).toBe(DOUBLE_EIGHTEEN_SET_SIZE);
    expect(DOUBLE_EIGHTEEN_SET_SIZE).toBe(190);
    // Throws on wrong count or duplicates.
    assertCoordinateSetSize(set, DOUBLE_EIGHTEEN_SET_SIZE);
  });
});


describe('Setup — hand sizes by fleet size [MoG][W]', () => {
  // Masters of Games & the "official" YouTube rules: 15 (2–4), 12 (5–6), 10 (7–8).
  // NOTE: Game Cabinet (Galt) & University Games use 11 for 7–8. Warp 12 defaults
  // to 10 but exposes it as a host-configurable house rule (largeFleetHandSize).
  // See docs/mexican-train-rules-sources.md.
  it.each([
    [2, 15],
    [3, 15],
    [4, 15],
    [5, 12],
    [6, 12],
    [7, 10],
    [8, 10],
  ])('deals %i captains %i tiles each', (players, expected) => {
    expect(handSizeForPlayerCount(players)).toBe(expected);
  });

  it('rejects fleet sizes outside 2–8', () => {
    expect(() => handSizeForPlayerCount(1)).toThrow();
    expect(() => handSizeForPlayerCount(9)).toThrow();
  });

  it('is host-configurable for 7–8 captains: opt into 11 (Galt/University)', () => {
    // The one contested setup value. Default = 10; hosts may pick 11.
    expect(handSizeForPlayerCount(7, 11)).toBe(11);
    expect(handSizeForPlayerCount(8, 11)).toBe(11);
    // The choice never affects smaller fleets.
    expect(handSizeForPlayerCount(4, 11)).toBe(15);
    expect(handSizeForPlayerCount(6, 11)).toBe(12);
  });

  it('deals 11 tiles to an 8-captain fleet when the house rule opts in', () => {
    const set = shuffleCoordinates(generateCoordinateSet(12), () => 0.17);
    const captains = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      displayName: `p${i}`,
      pointsScore: 0,
    }));
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: set,
      roundNumber: 1,
      captains,
      turnOrder: captains.map((c) => c.id),
      largeFleetHandSize: 11,
    });
    for (const captain of captains) {
      expect(deal.hands[captain.id]).toHaveLength(11);
    }
    // 8×11 = 88 dealt + 1 Spacedock → only 2 tiles in the boneyard.
    expect(deal.unchartedSectors).toHaveLength(91 - 1 - 88);
    expect(deal.unchartedSectors).toHaveLength(2);
  });
});

describe('Setup — highest double set aside before the deal [W]', () => {
  // Wikipedia: "The highest double tile is set aside before shuffling ... placed
  // to open the station." It is NOT dealt into any hand or the boneyard.
  it('never deals the round Spacedock double, and boneyard = 91 − 1 − dealt', () => {
    const set = shuffleCoordinates(generateCoordinateSet(12), () => 0.42);
    const captains = [
      { id: 'a', displayName: 'a', pointsScore: 0 },
      { id: 'b', displayName: 'b', pointsScore: 0 },
      { id: 'c', displayName: 'c', pointsScore: 0 },
      { id: 'd', displayName: 'd', pointsScore: 0 },
    ];
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: set,
      roundNumber: 1,
      captains,
      turnOrder: captains.map((c) => c.id),
    });

    const spacedockKey = coordinateKey(normalizeCoordinate(12, 12));
    const handSize = handSizeForPlayerCount(captains.length);

    for (const captain of captains) {
      expect(deal.hands[captain.id]).toHaveLength(handSize);
      expect(
        deal.hands[captain.id].some((c) => coordinateKey(c) === spacedockKey)
      ).toBe(false);
    }
    expect(
      deal.unchartedSectors.some((c) => coordinateKey(c) === spacedockKey)
    ).toBe(false);
    expect(deal.unchartedSectors).toHaveLength(
      91 - 1 - handSize * captains.length
    );
  });
});

describe('Setup — Spacedock descends 12-12 → 0-0 over 13 rounds [W]', () => {
  it('steps the double down one per round', () => {
    expect(spacedockValueForRound(1)).toBe(12);
    expect(spacedockValueForRound(2)).toBe(11);
    expect(spacedockValueForRound(13)).toBe(0);
    // Go-out overtime (and any round past the natural ladder) wraps to maxPip.
    expect(spacedockValueForRound(14)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// III. Standard gameplay
// ---------------------------------------------------------------------------

function openingRound(handA: ReturnType<typeof T>[]) {
  // Fresh round: empty trails, Spacedock 12, captain 'a' to open.
  return makeRound(['a', 'b'], {
    activePlayerId: 'a',
    spacedockValue: 12,
    hands: { a: handA, b: [] },
    unchartedSectors: [],
  });
}

describe('Play — must play when able; no strategic pass [W BR3][MTR]', () => {
  it('forbids deploying a beacon while a legal chart exists', () => {
    const round = openingRound([T(12, 5)]);
    expect(getLegalMoves(round, 'a', rules).length).toBeGreaterThan(0);
    expect(canDeployDistressBeacon(round, 'a', { houseRules: rules })).toBe(
      false
    );

    const state = makeGame(round, { houseRules: rules });
    const attempt = applyAction(state, {
      type: 'DEPLOY_DISTRESS_BEACON',
      playerId: 'a',
    });
    expect(attempt.ok).toBe(false);
  });
});

describe('Play — draw one, then play it or mark; one draw per turn [W rule4][UBG][DP]', () => {
  it('lets a stuck captain draw, then requires playing the drawn playable tile', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(3, 4)], b: [] }, // no 12 → nothing to open with
      unchartedSectors: [T(12, 6)], // top of pile is playable
    });
    expect(getLegalMoves(round, 'a', rules)).toHaveLength(0);
    expect(canDrawFromUncharted(round, 'a', rules)).toBe(true);

    const state = makeGame(round, { houseRules: rules });
    const drew = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });
    expect(drew.ok).toBe(true);
    if (!drew.ok) return;
    const after = drew.state.round!;

    expect(after.hands.a).toHaveLength(2);
    // The drawn 12-6 is now playable, so a must chart it this turn...
    expect(getLegalMoves(after, 'a', rules).length).toBeGreaterThan(0);
    // ...and may not draw a second time.
    expect(canDrawFromUncharted(after, 'a', rules)).toBe(false);
  });

  it('drops the marker and ends the turn atomically when the drawn tile is unplayable', () => {
    // Standard rule: draw one; if it still cannot be played, the marker goes
    // down and the turn ends — the engine resolves this in a single step.
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [T(3, 5)], // no 12 → still unplayable after draw
    });
    const state = makeGame(round, { houseRules: rules });
    const drew = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });
    expect(drew.ok).toBe(true);
    if (!drew.ok) return;
    const after = drew.state.round!;

    expect(after.hands.a).toHaveLength(2); // kept the unplayable drawn tile
    expect(after.table.warpTrails.a.distressBeacon.active).toBe(true);
    expect(after.activePlayerId).toBe('b'); // turn ended
  });
});

describe('Play — marker clears only on your own trail [W][UBG]', () => {
  function markedRound(over = {}) {
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    return makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        neutralZone: { tiles: [placed(T(12, 3), 0, 3)] },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 4), 0, 4)],
            distressBeacon: { active: true },
          },
        },
      },
      ...over,
    });
  }

  it('raises shields (removes beacon) when charting your own trail', () => {
    const round = markedRound({ hands: { a: [T(4, 5)], b: [] } });
    const state = makeGame(round, { houseRules: rules });
    const play = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(4, 5),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(play.ok).toBe(true);
    if (!play.ok) return;
    expect(play.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
      false
    );
  });

  it('leaves the beacon active when charting the Neutral Zone', () => {
    const round = markedRound({ hands: { a: [T(3, 6)], b: [] } });
    const state = makeGame(round, { houseRules: rules });
    const play = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(3, 6),
      route: { kind: 'neutral-zone' },
    });
    expect(play.ok).toBe(true);
    if (!play.ok) return;
    expect(play.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
      true
    );
  });
});

describe("Play — an opponent's trail is playable only while marked [W][UBG][DP]", () => {
  function withOpponentTrail(beaconActive: boolean) {
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    return makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(4, 5)], b: [] },
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          // a already has an established trail open on 9 (so 4-5 can't go there)
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 9), 0, 9)],
            distressBeacon: { active: false },
          },
          b: {
            ...base.table.warpTrails.b,
            tiles: [placed(T(12, 4), 0, 4)],
            distressBeacon: { active: beaconActive },
          },
        },
      },
    });
  }

  it('blocks a play on a rival trail whose shields are up (no marker)', () => {
    const round = withOpponentTrail(false);
    expect(
      isLegalMove(round, 'a', T(4, 5), { kind: 'warp-trail', playerId: 'b' }, rules)
    ).toBe(false);
  });

  it('allows a play on a rival trail whose marker is down', () => {
    const round = withOpponentTrail(true);
    expect(
      isLegalMove(round, 'a', T(4, 5), { kind: 'warp-trail', playerId: 'b' }, rules)
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IV. Doubles (Red Alert)
// ---------------------------------------------------------------------------

describe('Doubles — an open double blocks all other routes [W][MTR]', () => {
  // Wikipedia: "All other trains become ineligible until someone finishes the
  // double." Only the cover play (on the double) is legal.
  it('offers only the cover route while a double is unsatisfied', () => {
    const base = makeRound(['a', 'b'], { activePlayerId: 'b', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'b',
      spacedockValue: 12,
      hands: { a: [], b: [T(6, 7), T(1, 2)] },
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        neutralZone: { tiles: [placed(T(3, 3), 0, 3)] },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(6, 6), 0, 6)],
            distressBeacon: { active: true },
          },
        },
        redAlert: {
          active: true,
          anchor: placed(T(6, 6), 0, 6),
          responsiblePlayerId: 'b',
          trailPlayerId: 'a',
        },
      },
    });

    const moves = getLegalMoves(round, 'b', rules);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move.route.kind).toBe('red-alert-cover');
    }
    // 6-7 covers the 6-6; 1-2 does not touch a 6 → not offered.
    expect(moves.some((m) => coordinateKey(m.coordinate) === '6-7')).toBe(true);
    expect(moves.some((m) => coordinateKey(m.coordinate) === '1-2')).toBe(false);
  });
});

describe('Doubles — a dead double need not be covered [W][MTR]', () => {
  // Wikipedia: "If it is not possible to cover the double because that double is
  // the last domino with that pip value, it does not need to be covered."
  it('recognizes the pip as exhausted and the Red Alert as dead', () => {
    const sixes = allTilesWithPip(6); // all 13 tiles containing a 6
    const base = makeRound(['a', 'b'], { activePlayerId: 'b', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'b',
      spacedockValue: 12,
      table: {
        ...base.table,
        neutralZone: {
          tiles: sixes.map((coordinate, index) => placed(coordinate, index, 6)),
        },
        redAlert: {
          active: true,
          anchor: placed(T(6, 6), 0, 6),
          responsiblePlayerId: 'b',
          neutralZone: true,
        },
      },
    });

    expect(isPipExhausted(round, 6)).toBe(true);
    expect(isRedAlertDoubleDead(round)).toBe(true);
  });
});

describe('Doubles — you cannot go out on an unsatisfied double [W][MTR]', () => {
  // Divergence note: UBG and domino-play allow going out on a final double.
  // Warp 12 follows the tournament / Wikipedia convention: the double must be
  // covered first. See docs/mexican-train-rules-sources.md.
  it('does not end the round when the last tile is an uncovered double', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(12, 12)], b: [T(0, 1)] },
      unchartedSectors: [T(2, 3)],
    });
    const state = makeGame(round, { houseRules: rules });
    const play = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 12),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(play.ok).toBe(true);
    if (!play.ok) return;

    const after = play.state.round!;
    expect(after.hands.a).toHaveLength(0); // hand empty...
    expect(after.phase).toBe('playing'); // ...but the round is NOT over
    expect(after.roundWinnerId).toBeNull();
    expect(after.table.redAlert?.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// V. Scoring
// ---------------------------------------------------------------------------

describe('Scoring — winner scores 0, others sum their pips [W][MoG]', () => {
  it('adds each losing hand’s pip total; winner unchanged', () => {
    const round = makeRound(['a', 'b', 'c'], {
      roundNumber: 13, // final round → no re-deal, game completes
      spacedockValue: 0,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: {
        a: [],
        b: [T(5, 3), T(9, 9), T(6, 0)], // 8 + 18 + 6 = 32
        c: [T(4, 2)], // 6
      },
    });
    const state = makeGame(round, {
      objective: 'points',
      campaignRounds: 13,
      captains: [
        { id: 'a', displayName: 'a', pointsScore: 0 },
        { id: 'b', displayName: 'b', pointsScore: 0 },
        { id: 'c', displayName: 'c', pointsScore: 0 },
      ],
    });

    const scored = scoreRound(state, round, () => 0.5);
    expect(scored.ok).toBe(true);
    if (!scored.ok) return;

    const byId = Object.fromEntries(
      scored.state.captains.map((c) => [c.id, c.pointsScore])
    );
    expect(byId.a).toBe(0);
    expect(byId.b).toBe(coordinatePipValue(T(5, 3)) + 18 + 6);
    expect(byId.b).toBe(32);
    expect(byId.c).toBe(6);
    expect(scored.state.phase).toBe('complete');
  });
});

describe('Scoring — blocked sector scores every captain, no exemption [W][MTR]', () => {
  // Wikipedia: the round also ends "when it is not possible to play another
  // domino and the boneyard is empty"; every player then scores their hand.
  it('adds all hands including the lowest-pip captain', () => {
    const round = makeRound(['a', 'b', 'c'], {
      roundNumber: 13,
      spacedockValue: 0,
      phase: 'ended',
      roundBlocked: true,
      roundWinnerId: null,
      hands: {
        a: [T(1, 2)], // 3
        b: [T(4, 4)], // 8
        c: [], // 0 — still "counted", just empty
      },
    });
    const state = makeGame(round, {
      objective: 'points',
      campaignRounds: 13,
      captains: [
        { id: 'a', displayName: 'a', pointsScore: 0 },
        { id: 'b', displayName: 'b', pointsScore: 0 },
        { id: 'c', displayName: 'c', pointsScore: 0 },
      ],
    });

    const scored = scoreRound(state, round, () => 0.5);
    expect(scored.ok).toBe(true);
    if (!scored.ok) return;

    const byId = Object.fromEntries(
      scored.state.captains.map((c) => [c.id, c.pointsScore])
    );
    expect(byId.a).toBe(3);
    expect(byId.b).toBe(8);
    expect(byId.c).toBe(0);
  });
});
