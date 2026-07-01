import type { Rng } from 'doubletwelve';

import type { PlayerId } from '../types/player.js';

/** FNV-1a hash for stable replay seeds from game ids. */
export function hashStringSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Per-move seed so advisor search replays identically for the same log. */
export function advisorReplaySeed(
  baseSeed: number,
  turnIndex: number,
  playerId: PlayerId
): number {
  let hash = baseSeed >>> 0;
  hash = Math.imul(hash ^ turnIndex, 2654435761);
  for (let i = 0; i < playerId.length; i++) {
    hash = Math.imul(hash ^ playerId.charCodeAt(i), 1597334677);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
