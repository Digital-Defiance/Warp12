import { describe, expect, it } from 'vitest';

import { applyAction } from '../engine/apply-action.js';
import { makeGame, makeRound, placed, T } from '../engine/test-helpers.js';
import { createInitialTable } from '../table/table-state.js';
import { resolveModules } from '../types/modules.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { getWarpSkillProfile } from './skill.js';
import {
  chooseHandExchangeGiveback,
  scoreHandExchangeGiveback,
} from './hand-exchange-ai.js';
import { observe } from './observation.js';

describe('hand exchange AI', () => {
  it('prefers giving a high-pip tile that misses open ends', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'b',
      hands: {
        a: [T(12, 11), T(0, 0), T(9, 8)],
        b: [T(3, 2)],
      },
      table: {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          a: {
            ...table.warpTrails.a,
            tiles: [placed(T(12, 10), 0, 12)],
          },
        },
      },
      handExchangePending: {
        largerPlayerId: 'a',
        smallerPlayerId: 'b',
        takenCoordinate: T(3, 2),
      },
    });
    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ temporalInversion: true }),
    });
    const obs = observe(state, 'a')!;
    expect(scoreHandExchangeGiveback(T(9, 8), obs)).toBeGreaterThan(
      scoreHandExchangeGiveback(T(12, 11), obs)
    );
    const pick = chooseHandExchangeGiveback(obs, { rng: () => 0 });
    expect(pick).toEqual(T(9, 8));
  });

  it('resolve-hand-exchange is chosen by Warp AI when pending', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'b',
      hands: {
        a: [T(5, 4), T(11, 10)],
        b: [T(1, 0)],
      },
      table,
      handExchangePending: {
        largerPlayerId: 'a',
        smallerPlayerId: 'b',
        takenCoordinate: T(1, 0),
      },
    });
    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ temporalInversion: true }),
    });
    const ai = createWarpAiPlayer({
      skill: getWarpSkillProfile('commander', 'go-out', 2),
      objective: 'go-out',
      rng: () => 0.1,
    });
    const action = ai.decideGameAction(state, 'a');
    expect(action?.type).toBe('RESOLVE_HAND_EXCHANGE');
    if (action?.type !== 'RESOLVE_HAND_EXCHANGE') return;
    const result = applyAction(state, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round?.handExchangePending ?? null).toBe(null);
  });
});
