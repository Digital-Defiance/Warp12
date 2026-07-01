import { describe, expect, it } from 'vitest';

import { getLegalMoves } from '../engine/legal-moves.js';
import { makeGame, makeRound } from '../engine/test-helpers.js';
import { buildAdvisorReport, reviewAdvisorMove } from './advisor-report.js';
import { getAdvisorSkillProfile } from './skill.js';
import { gameActionToWarpAi, warpAiActionKey } from './from-game-action.js';
import type { WarpAiAction } from './actions.js';

describe('advisor report', () => {
  it('uses a skill profile that never random-blunders', () => {
    expect(getAdvisorSkillProfile('go-out', 4).blunderRate).toBe(0);
    expect(getAdvisorSkillProfile('go-out', 4).temperature).toBe(0);
    expect(getAdvisorSkillProfile('points', 2).blunderRate).toBe(0);
  });

  it('converts chart actions into warp AI actions', () => {
    const action = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: { low: 12, high: 11 },
      route: { kind: 'warp-trail' as const, playerId: 'a' },
    };
    const warp = gameActionToWarpAi(action, 'a');
    expect(warp?.kind).toBe('chart');
    expect(warpAiActionKey(warp!)).toContain('12-11');
  });

  it('reviews a human chart with reasons or blunder guidance', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 1,
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: {
        a: [
          { low: 12, high: 11 },
          { low: 11, high: 9 },
          { low: 9, high: 5 },
        ],
        b: [{ low: 6, high: 6 }, { low: 8, high: 7 }, { low: 7, high: 4 }],
      },
    });
    const state = makeGame(round, { objective: 'go-out' });
    const played: WarpAiAction = {
      kind: 'chart',
      move: {
        coordinate: { low: 12, high: 11 },
        route: { kind: 'warp-trail', playerId: 'a' },
      },
    };

    const review = reviewAdvisorMove(state, 'a', played);
    expect(review).not.toBeNull();
    expect(['strong', 'reasonable', 'weak', 'blunder']).toContain(
      review!.strength
    );
    if (review!.strength !== 'blunder') {
      expect(review!.reasons.length).toBeGreaterThan(0);
    }
  });

  it('builds a play-by-play report from round-start state and log entries', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 1,
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: {
        a: [
          { low: 12, high: 11 },
          { low: 11, high: 9 },
        ],
        b: [{ low: 6, high: 6 }, { low: 8, high: 7 }],
      },
    });
    const start = makeGame(round, { objective: 'go-out' });
    const legal = getLegalMoves(start.round!, 'a').find(
      (move) => move.route.kind === 'warp-trail' && move.route.playerId === 'a'
    );
    expect(legal).toBeDefined();
    const first = {
      type: 'CHART_COORDINATE' as const,
      playerId: 'a',
      coordinate: legal!.coordinate,
      route: legal!.route,
    };

    const report = buildAdvisorReport({
      roundStartState: start,
      entries: [{ playerId: 'a', action: first, source: 'human', ok: true }],
      focusPlayerIds: ['a'],
    });

    expect(report.reviews.length).toBe(1);
    expect(report.reviews[0]?.playerId).toBe('a');
  });
});
