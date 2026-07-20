import { describe, expect, it } from 'vitest';

import { computeFitView, nextLogVisibilityMode } from './table-viewport.js';

describe('computeFitView', () => {
  it('fits the table inside the viewport with margin', () => {
    const { scale, pan } = computeFitView(390, 280, 1200, 800, 0.2);
    expect(scale).toBeLessThan(0.35);
    expect(scale).toBeGreaterThanOrEqual(0.2);
    expect(pan.x).toBeGreaterThan(0);
    expect(pan.y).toBeGreaterThanOrEqual(0);
  });

  it('uses a scale of 1 when the table already fits', () => {
    const { scale } = computeFitView(1250, 900, 1200, 800, 0.2);
    expect(scale).toBe(1);
  });
});

describe('nextLogVisibilityMode', () => {
  it('cycles all captains → yourself → commentator → silenced', () => {
    expect(nextLogVisibilityMode('all')).toBe('mine');
    expect(nextLogVisibilityMode('mine')).toBe('commentator');
    expect(nextLogVisibilityMode('commentator')).toBe('off');
    expect(nextLogVisibilityMode('off')).toBe('all');
  });
});
