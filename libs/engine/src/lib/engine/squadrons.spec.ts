import { describe, expect, it } from 'vitest';
import {
  formSquadrons,
  rankSquads,
  reconcileSquadronRosters,
  sameTrailGroup,
  squadronDisplayName,
  squadronForPlayer,
  trailGroupMembers,
  trailKeyFor,
} from './squadrons.js';
import { startGame } from '../setup/create-game.js';
import { getLegalMoves } from './legal-moves.js';
import { applyAction } from './apply-action.js';
import { scoreRound } from './scoring.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import { mulberry32 } from './random-play-harness.js';
import { T, makeRound, makeGame, placed } from './test-helpers.js';
import { resolveModules } from '../types/modules.js';
import { createWarpAiPlayer } from '../ai/create-warp-ai.js';
import { getWarpSkillProfile } from '../ai/skill.js';
import type { Captain } from '../types/player.js';
import type { RoundState } from '../types/game-state.js';

const ZETA_MODULES = resolveModules({ squadrons: true, squadronSize: 2 });

function squadCaptains(): Captain[] {
  // squad-1 = a,c ; squad-2 = b,d (matches formSquadrons round-robin)
  return [
    { id: 'a', displayName: 'A', pointsScore: 0, squadronId: 'squad-1' },
    { id: 'b', displayName: 'B', pointsScore: 0, squadronId: 'squad-2' },
    { id: 'c', displayName: 'C', pointsScore: 0, squadronId: 'squad-1' },
    { id: 'd', displayName: 'D', pointsScore: 0, squadronId: 'squad-2' },
  ];
}

describe('formSquadrons', () => {
  it('splits 4 captains into 2 squads of 2', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);
    expect(squadrons).toHaveLength(2);
    // Round-robin dealing: squad1 = a,c ; squad2 = b,d
    expect(squadrons[0].memberIds).toEqual(['a', 'c']);
    expect(squadrons[1].memberIds).toEqual(['b', 'd']);
  });

  it('assigns the first member as the canonical trail key', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);
    expect(squadrons[0].trailKey).toBe('a');
    expect(squadrons[1].trailKey).toBe('b');
  });

  it('interleaves turn order so squadmates never sit consecutively', () => {
    const { turnOrder } = formSquadrons(['a', 'b', 'c', 'd'], 2);
    // squad0[0], squad1[0], squad0[1], squad1[1] => a, b, c, d
    expect(turnOrder).toEqual(['a', 'b', 'c', 'd']);
    // Adjacent seats belong to different squads
    expect(turnOrder[0]).not.toBe('c'); // a and c are squadmates
  });

  it('splits 6 captains into 2 squads of 3 with interleaved seating', () => {
    const { squadrons, turnOrder } = formSquadrons(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      3
    );
    expect(squadrons).toHaveLength(2);
    expect(squadrons[0].memberIds).toEqual(['a', 'c', 'e']);
    expect(squadrons[1].memberIds).toEqual(['b', 'd', 'f']);
    // slot-major interleave: a,b (slot0), c,d (slot1), e,f (slot2)
    expect(turnOrder).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('splits 6 captains into 3 squads of 2', () => {
    const { squadrons, turnOrder } = formSquadrons(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      2
    );
    expect(squadrons).toHaveLength(3);
    expect(squadrons.map((s) => s.memberIds)).toEqual([
      ['a', 'd'],
      ['b', 'e'],
      ['c', 'f'],
    ]);
    expect(turnOrder).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('rejects invalid squadron sizes', () => {
    expect(() => formSquadrons(['a', 'b', 'c', 'd'], 1)).toThrow(RangeError);
    expect(() => formSquadrons(['a', 'b', 'c', 'd'], 4)).toThrow(RangeError);
  });

  it('rejects fleets that cannot form 2 equal squads', () => {
    expect(() => formSquadrons(['a', 'b'], 2)).toThrow(RangeError); // only 1 squad
    expect(() => formSquadrons(['a', 'b', 'c', 'd', 'e'], 2)).toThrow(
      RangeError
    ); // uneven
  });

  it('forms from explicit host-assigned rosters', () => {
    const { squadrons, turnOrder } = formSquadrons(
      ['a', 'b', 'c', 'd'],
      2,
      ['Home', 'Away'],
      [
        ['a', 'b'],
        ['c', 'd'],
      ]
    );
    expect(squadrons.map((s) => s.memberIds)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(squadrons[0].name).toBe('Home');
    expect(squadrons[1].name).toBe('Away');
    // Bridge seating: home0, away0, home1, away1
    expect(turnOrder).toEqual(['a', 'c', 'b', 'd']);
  });

  it('rejects explicit rosters that omit or duplicate captains', () => {
    expect(() =>
      formSquadrons(
        ['a', 'b', 'c', 'd'],
        2,
        undefined,
        [
          ['a', 'b'],
          ['a', 'c'],
        ]
      )
    ).toThrow(/more than one squad/);
    expect(() =>
      formSquadrons(
        ['a', 'b', 'c', 'd'],
        2,
        undefined,
        [
          ['a', 'b'],
          ['c', 'x'],
        ]
      )
    ).toThrow(/not in the fleet/);
  });
});

describe('reconcileSquadronRosters', () => {
  it('auto-forms when no prior assignment exists', () => {
    expect(reconcileSquadronRosters(['a', 'b', 'c', 'd'], 2, null)).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
  });

  it('preserves explicit pairing when a captain leaves and another joins', () => {
    const next = reconcileSquadronRosters(
      ['a', 'b', 'c', 'e'],
      2,
      [
        ['a', 'b'],
        ['c', 'd'],
      ]
    );
    expect(next).toEqual([
      ['a', 'b'],
      ['c', 'e'],
    ]);
  });
});

describe('formSquadrons naming', () => {
  it('assigns host-chosen names, index-aligned with formation order', () => {
    const { squadrons } = formSquadrons(
      ['a', 'b', 'c', 'd'],
      2,
      ['Away Team', 'Home Team']
    );
    expect(squadrons[0].name).toBe('Away Team');
    expect(squadrons[1].name).toBe('Home Team');
  });

  it('leaves a squad unnamed when its entry is blank or missing', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2, ['  ', undefined]);
    expect(squadrons[0].name).toBeUndefined();
    expect(squadrons[1].name).toBeUndefined();
  });

  it('trims whitespace from names', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2, ['  Away Team  ']);
    expect(squadrons[0].name).toBe('Away Team');
  });

  it('works with no names array at all (backward compatible)', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);
    expect(squadrons[0].name).toBeUndefined();
    expect(squadrons[1].name).toBeUndefined();
  });
});

describe('squadronDisplayName', () => {
  it('returns the host-chosen name when set', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2, ['Away Team']);
    expect(squadronDisplayName(squadrons, squadrons[0])).toBe('Away Team');
  });

  it('falls back to "Squad N" (1-indexed) when unnamed', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd', 'e', 'f'], 2);
    expect(squadronDisplayName(squadrons, squadrons[0])).toBe('Squad 1');
    expect(squadronDisplayName(squadrons, squadrons[1])).toBe('Squad 2');
    expect(squadronDisplayName(squadrons, squadrons[2])).toBe('Squad 3');
  });

  it('mixes named and unnamed squads correctly', () => {
    const { squadrons } = formSquadrons(
      ['a', 'b', 'c', 'd'],
      2,
      [undefined, 'Home Team']
    );
    expect(squadronDisplayName(squadrons, squadrons[0])).toBe('Squad 1');
    expect(squadronDisplayName(squadrons, squadrons[1])).toBe('Home Team');
  });
});

describe('trail resolution (Model C)', () => {
  const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);
  const squadRound = { squadrons } as unknown as RoundState;
  const ffaRound = {} as unknown as RoundState;

  it('maps squadmates to the shared canonical trail key', () => {
    expect(trailKeyFor(squadRound, 'a')).toBe('a');
    expect(trailKeyFor(squadRound, 'c')).toBe('a'); // c shares a's trail
    expect(trailKeyFor(squadRound, 'b')).toBe('b');
    expect(trailKeyFor(squadRound, 'd')).toBe('b');
  });

  it('is the identity in FFA (no squadrons)', () => {
    expect(trailKeyFor(ffaRound, 'a')).toBe('a');
    expect(trailKeyFor(ffaRound, 'z')).toBe('z');
  });

  it('treats squadmates as sharing a trail, opponents as not', () => {
    expect(sameTrailGroup(squadRound, 'a', 'c')).toBe(true);
    expect(sameTrailGroup(squadRound, 'a', 'b')).toBe(false);
    // FFA: only self shares own trail
    expect(sameTrailGroup(ffaRound, 'a', 'a')).toBe(true);
    expect(sameTrailGroup(ffaRound, 'a', 'b')).toBe(false);
  });

  it('lists trail-group members', () => {
    expect(trailGroupMembers(squadRound, 'a')).toEqual(['a', 'c']);
    expect(trailGroupMembers(ffaRound, 'a')).toEqual(['a']);
  });

  it('finds the squadron for a player', () => {
    expect(squadronForPlayer(squadrons, 'd')?.id).toBe('squad-2');
    expect(squadronForPlayer(undefined, 'd')).toBeNull();
    expect(squadronForPlayer(squadrons, 'z')).toBeNull();
  });
});

describe('startGame with Module Zeta', () => {
  function startSquadGame() {
    const rng = mulberry32(42);
    const shuffled = shuffleCoordinates(generateCoordinateSet(12), rng);
    return startGame(
      {
        id: 'zeta',
        captains: [
          { id: 'a', displayName: 'A' },
          { id: 'b', displayName: 'B' },
          { id: 'c', displayName: 'C' },
          { id: 'd', displayName: 'D' },
        ],
        modules: { squadrons: true, squadronSize: 2 },
        objective: 'points',
      },
      { shuffledCoordinates: shuffled }
    );
  }

  it('forms squadrons and records them on game + round state', () => {
    const state = startSquadGame();
    expect(state.squadrons).toHaveLength(2);
    expect(state.round?.squadrons).toHaveLength(2);
  });

  it('assigns squadronId to every captain', () => {
    const state = startSquadGame();
    const byId = new Map(state.captains.map((c) => [c.id, c.squadronId]));
    expect(byId.get('a')).toBe('squad-1');
    expect(byId.get('c')).toBe('squad-1');
    expect(byId.get('b')).toBe('squad-2');
    expect(byId.get('d')).toBe('squad-2');
  });

  it('threads host-chosen squadronNames from modules config into the formed squads', () => {
    const rng = mulberry32(42);
    const shuffled = shuffleCoordinates(generateCoordinateSet(12), rng);
    const state = startGame(
      {
        id: 'zeta-named',
        captains: [
          { id: 'a', displayName: 'A' },
          { id: 'b', displayName: 'B' },
          { id: 'c', displayName: 'C' },
          { id: 'd', displayName: 'D' },
        ],
        modules: {
          squadrons: true,
          squadronSize: 2,
          squadronNames: ['Away Team', 'Home Team'],
        },
        objective: 'points',
      },
      { shuffledCoordinates: shuffled }
    );
    expect(state.squadrons?.[0].name).toBe('Away Team');
    expect(state.squadrons?.[1].name).toBe('Home Team');
  });

  it('creates one shared trail per squad (keyed by trailKey)', () => {
    const state = startSquadGame();
    const trailKeys = Object.keys(state.round!.table.warpTrails).sort();
    // squad-1 trailKey = a, squad-2 trailKey = b
    expect(trailKeys).toEqual(['a', 'b']);
  });

  it('uses interleaved bridge seating for the turn order', () => {
    const state = startSquadGame();
    expect(state.round?.turnOrder).toEqual(['a', 'b', 'c', 'd']);
  });

  it('lets the round starter open the shared squad trail (route uses trailKey)', () => {
    const state = startSquadGame();
    const round = state.round!;
    const starter = round.activePlayerId;
    const starterTrailKey = trailKeyFor(round, starter);
    const moves = getLegalMoves(round, starter);
    // Every own-trail opening move must target the squad's canonical trail key.
    const ownTrailMoves = moves.filter(
      (m) => m.route.kind === 'warp-trail'
    );
    for (const m of ownTrailMoves) {
      if (m.route.kind === 'warp-trail') {
        expect(m.route.playerId).toBe(starterTrailKey);
      }
    }
  });
});

describe('Module Zeta — shared beacon semantics', () => {
  const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);

  it("clears the squad beacon when a squadmate charts the shared trail", () => {
    // Squad-1 (a,c) share trail keyed 'a', beacon deployed. It is c's turn and
    // c can chart the shared trail — the beacon must lift for the whole squad.
    const base = makeRound(['a', 'b', 'c', 'd'], {
      spacedockValue: 6,
      activePlayerId: 'c',
      squadrons,
      hands: { a: [], b: [], c: [T(3, 2)], d: [] },
    });
    const round: RoundState = {
      ...base,
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 3), 0, 3)],
            distressBeacon: { active: true },
          },
        },
      },
    };
    const game = makeGame(round, {
      modules: ZETA_MODULES,
      captains: squadCaptains(),
    });

    const result = applyAction(game, {
      type: 'CHART_COORDINATE',
      playerId: 'c',
      coordinate: T(3, 2),
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.state.round!.table.warpTrails['a'].distressBeacon.active
    ).toBe(false);
  });
});

describe('Module Zeta — squad points scoring', () => {
  const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);

  it('scores the winning squad 0 and each losing member the squad aggregate', () => {
    // Final round so scoreRound completes without re-dealing. a went out →
    // squad-1 (a,c) wins. squad-2 (b,d) holds 9-9 (18) + 6-0 (6) = 24 aggregate.
    const round = makeRound(['a', 'b', 'c', 'd'], {
      roundNumber: 13,
      spacedockValue: 0,
      phase: 'ended',
      roundWinnerId: 'a',
      squadrons,
      hands: {
        a: [],
        c: [T(5, 3)], // 8 pips, but forgiven — winning squad
        b: [T(9, 9)], // 18
        d: [T(6, 0)], // 6
      },
    });
    const game = makeGame(round, {
      objective: 'points',
      campaignRounds: 13,
      modules: ZETA_MODULES,
      captains: squadCaptains(),
    });

    const result = scoreRound(game, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const score = Object.fromEntries(
      result.state.captains.map((c) => [c.id, c.pointsScore])
    );
    expect(score['a']).toBe(0);
    expect(score['c']).toBe(0); // winning squad — held tiles forgiven
    expect(score['b']).toBe(24); // squad aggregate
    expect(score['d']).toBe(24); // same squad aggregate stored per member
  });

  it('blocked round: every squad scores its own aggregate (no exemption)', () => {
    // No domino winner — every captain counts their hand. squad-1 (a,c) holds
    // 5-3 (8) + 4-2 (6) = 14. squad-2 (b,d) holds 9-9 (18) + 6-0 (6) = 24.
    const round = makeRound(['a', 'b', 'c', 'd'], {
      roundNumber: 13,
      spacedockValue: 0,
      phase: 'ended',
      roundWinnerId: null,
      roundBlocked: true,
      squadrons,
      hands: {
        a: [T(5, 3)], // 8
        c: [T(4, 2)], // 6
        b: [T(9, 9)], // 18
        d: [T(6, 0)], // 6
      },
    });
    const game = makeGame(round, {
      objective: 'points',
      campaignRounds: 13,
      modules: ZETA_MODULES,
      captains: squadCaptains(),
    });

    const result = scoreRound(game, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const score = Object.fromEntries(
      result.state.captains.map((c) => [c.id, c.pointsScore])
    );
    expect(score['a']).toBe(14); // squad-1 aggregate
    expect(score['c']).toBe(14);
    expect(score['b']).toBe(24); // squad-2 aggregate
    expect(score['d']).toBe(24);
  });
});

describe('Module Zeta — AI squad coordination', () => {
  const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);

  it('a Commander AI prefers charting the shared squad trail over an equally legal opposing trail', () => {
    // c is squadmates with a (shared trail keyed 'a'). Both a's trail (squad,
    // beacon down) and b's trail (opposing squad, open beacon) accept a 4.
    // squadCoordination should tip a deterministic (temperature 0) Commander
    // toward the squad trail, and the extra beacon-clear bonus reinforces it.
    const base = makeRound(['a', 'b', 'c', 'd'], {
      spacedockValue: 6,
      activePlayerId: 'c',
      squadrons,
      hands: { a: [], b: [], c: [T(4, 7)], d: [] },
    });
    const round: RoundState = {
      ...base,
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 4), 0, 4)],
            distressBeacon: { active: true }, // shared squad beacon — down
          },
          b: {
            playerId: 'b',
            tiles: [placed(T(6, 4), 0, 4)],
            distressBeacon: { active: true }, // open to others (shields down)
          },
        },
      },
    };
    const game = makeGame(round, {
      objective: 'points',
      modules: resolveModules({ squadrons: true, squadronSize: 2 }),
      captains: squadCaptains(),
    });

    // Sanity: both routes are legal for this tile.
    const moves = getLegalMoves(round, 'c');
    const trailMoves = moves.filter((m) => m.route.kind === 'warp-trail');
    expect(trailMoves.map((m) => (m.route as { playerId: string }).playerId).sort()).toEqual(
      ['a', 'b']
    );

    const commander = createWarpAiPlayer({
      skill: { ...getWarpSkillProfile('commander'), blunderRate: 0, temperature: 0 },
      objective: 'points',
      rng: () => 0,
    });
    const action = commander.decideGameAction(game, 'c');
    expect(action).not.toBeNull();
    expect(action).toMatchObject({
      type: 'CHART_COORDINATE',
      route: { kind: 'warp-trail', playerId: 'a' },
    });
  });
});

describe('rankSquads', () => {
  it('ranks squads by aggregate score, lower-is-better (points)', () => {
    const squadMembers = new Map([
      ['squad-1', ['a', 'c']],
      ['squad-2', ['b', 'd']],
    ]);
    const scores = new Map([
      ['a', 0],
      ['c', 0],
      ['b', 24],
      ['d', 24],
    ]);
    const ranks = rankSquads(squadMembers, scores, true);
    expect(ranks.get('squad-1')).toBe(1);
    expect(ranks.get('squad-2')).toBe(2);
  });

  it('ranks squads higher-is-better (go-out: winner pre-scored -1)', () => {
    const squadMembers = new Map([
      ['squad-1', ['a', 'c']],
      ['squad-2', ['b', 'd']],
    ]);
    // Winner's squad members score -1 (sorts first ascending); losers score
    // remaining hand size (fewer tiles = better position, matches
    // computeOnlineRanks' go-out convention).
    const scores = new Map([
      ['a', -1],
      ['c', -1],
      ['b', 4],
      ['d', 4],
    ]);
    const ranks = rankSquads(squadMembers, scores, true);
    expect(ranks.get('squad-1')).toBe(1);
    expect(ranks.get('squad-2')).toBe(2);
  });

  it('shares a rank when two squads tie on aggregate score', () => {
    const squadMembers = new Map([
      ['squad-1', ['a', 'c']],
      ['squad-2', ['b', 'd']],
      ['squad-3', ['e', 'f']],
    ]);
    const scores = new Map([
      ['a', 10],
      ['c', 10],
      ['b', 10],
      ['d', 10],
      ['e', 30],
      ['f', 30],
    ]);
    const ranks = rankSquads(squadMembers, scores, true);
    expect(ranks.get('squad-1')).toBe(1);
    expect(ranks.get('squad-2')).toBe(1);
    expect(ranks.get('squad-3')).toBe(3);
  });

  it('handles 3+ squads independently of squad size', () => {
    const squadMembers = new Map([
      ['squad-1', ['a', 'c', 'e']],
      ['squad-2', ['b', 'd', 'f']],
    ]);
    const scores = new Map([
      ['a', 5],
      ['c', 5],
      ['e', 5],
      ['b', 2],
      ['d', 2],
      ['f', 2],
    ]);
    const ranks = rankSquads(squadMembers, scores, true);
    expect(ranks.get('squad-2')).toBe(1); // lower aggregate wins
    expect(ranks.get('squad-1')).toBe(2);
  });
});
