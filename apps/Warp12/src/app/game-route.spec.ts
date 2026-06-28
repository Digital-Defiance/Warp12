import { describe, expect, it } from 'vitest';

import { preservesGameSession } from './game-route';

describe('preservesGameSession', () => {
  it('returns true for local and online play routes', () => {
    expect(preservesGameSession('/local')).toBe(true);
    expect(preservesGameSession('/online')).toBe(true);
    expect(preservesGameSession('/online/ABC123')).toBe(true);
    expect(preservesGameSession('/online/ABC123/play')).toBe(true);
  });

  it('returns false for marketing and doc routes', () => {
    expect(preservesGameSession('/')).toBe(false);
    expect(preservesGameSession('/rules')).toBe(false);
    expect(preservesGameSession('/privacy')).toBe(false);
  });
});
