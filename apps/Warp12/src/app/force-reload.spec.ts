import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forceReloadPage } from './force-reload.js';

describe('forceReloadPage', () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockReset();
    vi.stubGlobal('window', { location: { reload } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears Cache Storage before reloading', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('window', {
      location: { reload },
      caches: {
        keys: vi.fn().mockResolvedValue(['warp12-v1', 'firebase']),
        delete: vi.fn(async (key: string) => {
          deleted.push(key);
          return true;
        }),
      },
    });

    await forceReloadPage();

    expect(deleted).toEqual(['warp12-v1', 'firebase']);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads even when Cache Storage is unavailable', async () => {
    await forceReloadPage();

    expect(reload).toHaveBeenCalledOnce();
  });
});
