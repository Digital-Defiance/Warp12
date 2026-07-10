import type { PlayerId } from '../types/player.js';
import type { Rng } from 'double-eighteen';

/** Deterministic replay RNG — same log position always gets the same advisor search rollouts. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function advisorReplaySeed(
  replayBaseSeed: number,
  turnIndex: number,
  playerId: PlayerId
): number {
  let hash = replayBaseSeed >>> 0;
  hash = Math.imul(hash ^ turnIndex, 0x9e3779b1);
  for (let i = 0; i < playerId.length; i++) {
    hash = Math.imul(hash ^ playerId.charCodeAt(i), 0x85ebca6b);
  }
  return hash >>> 0;
}
