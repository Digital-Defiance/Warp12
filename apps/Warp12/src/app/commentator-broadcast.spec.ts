import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  COMMENTATOR_CHANNEL,
  isCommentatorBroadcastMessage,
  publishCommentatorSnapshot,
} from './commentator-broadcast.js';

describe('commentator-broadcast', () => {
  const posts: unknown[] = [];

  beforeEach(() => {
    posts.length = 0;
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        name: string;
        constructor(name: string) {
          this.name = name;
        }
        postMessage(data: unknown) {
          posts.push({ channel: this.name, data });
        }
        close() {
          // no-op
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('type-guards snapshot and hello messages', () => {
    expect(isCommentatorBroadcastMessage({ type: 'hello' })).toBe(true);
    expect(
      isCommentatorBroadcastMessage({
        type: 'snapshot',
        lines: [],
        nameColors: [],
        title: 'Round 1',
        at: 'x',
      })
    ).toBe(true);
    expect(isCommentatorBroadcastMessage({ type: 'nope' })).toBe(false);
  });

  it('publishes snapshots on the commentator channel', () => {
    publishCommentatorSnapshot({
      lines: ['00:01 - All Stop!'],
      nameColors: [],
      title: 'Round 1',
      sectorCode: 'ABC123',
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      channel: COMMENTATOR_CHANNEL,
      data: {
        type: 'snapshot',
        title: 'Round 1',
        sectorCode: 'ABC123',
        lines: ['00:01 - All Stop!'],
      },
    });
  });
});
