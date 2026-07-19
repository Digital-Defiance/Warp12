import { describe, expect, it } from 'vitest';
import { goOutAwareModuleLabel } from './go-out-module-labels.js';

describe('goOutAwareModuleLabel', () => {
  it('uses go-out names when objective is go-out', () => {
    expect(goOutAwareModuleLabel('beta', 'go-out')).toContain('Salamander Surge');
    expect(goOutAwareModuleLabel('theta', 'go-out')).toContain('Trail Momentum');
    expect(goOutAwareModuleLabel('eta', 'go-out')).toContain('Desperation Dig');
    expect(goOutAwareModuleLabel('kappa', 'go-out')).toContain('Hand Exchange');
    expect(goOutAwareModuleLabel('epsilon', 'go-out')).toContain('unavailable');
  });

  it('keeps points names for points objective', () => {
    expect(goOutAwareModuleLabel('beta', 'points')).toContain('Salamander penalty');
    expect(goOutAwareModuleLabel('theta', 'points')).toContain('Longest Trail');
    expect(goOutAwareModuleLabel('eta', 'points')).toContain('Temporal Debt');
    expect(goOutAwareModuleLabel('kappa', 'points')).toContain('Temporal Inversion');
  });
});
