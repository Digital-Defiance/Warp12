import { describe, expect, it } from 'vitest';

import { createOmegaPlayer } from './omega-agent.js';
import { createOmegaSearchPlayer } from './omega-search-agent.js';
import { createZeroOmegaModelWeights } from './omega-net.js';
import { playSelfPlayGame, type SelfPlaySeat } from './self-play.js';

function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('createOmegaSearchPlayer', () => {
  const net = createZeroOmegaModelWeights();

  it('completes a go-out game with an Omega+ seat vs greedy Omega', () => {
    const seats: SelfPlaySeat[] = ['a', 'b', 'c'].map((id, index) => ({
      id,
      displayName: id === 'a' ? 'Omega+' : `Omega-${id}`,
      player:
        id === 'a'
          ? createOmegaSearchPlayer({
              net,
              iterations: 24,
              rng: seededRng(100 + index),
            })
          : createOmegaPlayer({ net, rng: seededRng(100 + index) }),
    }));

    const result = playSelfPlayGame({ seats, seed: 7, objective: 'go-out' });

    expect(result.completed).toBe(true);
    expect(result.winnerId).not.toBeNull();
    expect(result.completedRounds).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed seed and budget', () => {
    const build = (): SelfPlaySeat[] =>
      ['a', 'b'].map((id, index) => ({
        id,
        player:
          id === 'a'
            ? createOmegaSearchPlayer({
                net,
                iterations: 16,
                rng: seededRng(55 + index),
              })
            : createOmegaPlayer({ net, rng: seededRng(55 + index) }),
      }));

    const first = playSelfPlayGame({
      seats: build(),
      seed: 21,
      objective: 'go-out',
    });
    const second = playSelfPlayGame({
      seats: build(),
      seed: 21,
      objective: 'go-out',
    });

    expect(second.winnerId).toBe(first.winnerId);
    expect(second.steps).toBe(first.steps);
  });
});
