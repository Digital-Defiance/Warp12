import { describe, expect, it } from 'vitest';

import { isRatedLaunchBlocked } from './rated-launch-gate.js';

describe('isRatedLaunchBlocked', () => {
  it('blocks anonymous rated launches by default', () => {
    expect(
      isRatedLaunchBlocked({ wantsRated: true, isAnonymous: true })
    ).toBe(true);
  });

  it('allows verified or casual launches', () => {
    expect(
      isRatedLaunchBlocked({ wantsRated: true, isAnonymous: false })
    ).toBe(false);
    expect(
      isRatedLaunchBlocked({ wantsRated: false, isAnonymous: true })
    ).toBe(false);
  });

  it('allows anonymous rated when e2e flag is set', () => {
    expect(
      isRatedLaunchBlocked({
        wantsRated: true,
        isAnonymous: true,
        e2eAllowRatedAnonymous: true,
      })
    ).toBe(false);
  });
});
