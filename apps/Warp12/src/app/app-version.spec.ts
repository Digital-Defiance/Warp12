import { describe, expect, it } from 'vitest';

import {
  appBuildNumber,
  formatAppVersionLabel,
} from './app-version';

describe('app-version', () => {
  it('parses build number from 0.MINOR.BUILD semver', () => {
    expect(appBuildNumber('0.6.51')).toBe(51);
    expect(appBuildNumber('dev')).toBeNull();
  });

  it('formats a version label with build metadata', () => {
    expect(formatAppVersionLabel('0.7.51')).toBe('v0.7.51 (build 51)');
    expect(formatAppVersionLabel('dev')).toBe('vdev');
  });
});
