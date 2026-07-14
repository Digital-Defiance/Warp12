import { describe, expect, it } from 'vitest';

import { resolveCommsMode } from './comms-mode.js';

describe('resolveCommsMode', () => {
  it('allows full comms in the lobby', () => {
    expect(resolveCommsMode(true, 'lobby')).toBe('full');
    expect(resolveCommsMode(false, 'lobby')).toBe('full');
  });

  it('restricts rated active play to quick-only', () => {
    expect(resolveCommsMode(true, 'active')).toBe('quick-only');
  });

  it('allows full comms in unrated active play', () => {
    expect(resolveCommsMode(false, 'active')).toBe('full');
  });

  it('allows full comms after a rated sector completes', () => {
    expect(resolveCommsMode(true, 'complete')).toBe('full');
  });

  it('Module Zeta: squad channel is always full, even rated + active', () => {
    expect(resolveCommsMode(true, 'active', 'squad')).toBe('full');
  });

  it('Module Zeta: table channel behavior is unchanged with explicit channel arg', () => {
    expect(resolveCommsMode(true, 'active', 'table')).toBe('quick-only');
    expect(resolveCommsMode(false, 'active', 'table')).toBe('full');
  });
});
