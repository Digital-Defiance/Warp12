import { describe, expect, it, beforeEach } from 'vitest';

import '../test/setup.js';
import {
  readHideAdminBanner,
  subscribeHideAdminBanner,
  writeHideAdminBanner,
} from './admin-banner-prefs.js';

describe('admin-banner-prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to showing the banner', () => {
    expect(readHideAdminBanner()).toBe(false);
  });

  it('persists hide and notifies subscribers', () => {
    const seen: boolean[] = [];
    const unsub = subscribeHideAdminBanner((hidden) => {
      seen.push(hidden);
    });

    writeHideAdminBanner(true);
    expect(readHideAdminBanner()).toBe(true);
    expect(seen).toEqual([true]);

    writeHideAdminBanner(false);
    expect(readHideAdminBanner()).toBe(false);
    expect(seen).toEqual([true, false]);

    unsub();
  });
});
