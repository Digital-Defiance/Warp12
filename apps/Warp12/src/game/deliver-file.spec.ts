import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canUseAnchorDownload,
  deliverBlob,
  downloadBlobViaAnchor,
  isShareGestureError,
} from './deliver-file.js';

describe('deliver-file', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('treats NotAllowedError as a lost share gesture', () => {
    expect(isShareGestureError(new DOMException('denied', 'NotAllowedError'))).toBe(
      true
    );
    expect(isShareGestureError(new Error('nope'))).toBe(false);
  });

  it('downloads via anchor when the platform supports it', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    expect(canUseAnchorDownload()).toBe(true);

    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const result = await deliverBlob({
      blob: new Blob(['hello'], { type: 'text/plain' }),
      filename: 'log.txt',
    });

    expect(result).toBe('downloaded');
    expect(anchor.download).toBe('log.txt');
    expect(click).toHaveBeenCalled();
  });

  it('still downloads on desktop Mac when the trackpad reports multi-touch', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('pointer: coarse') ? false : true,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));
    expect(canUseAnchorDownload()).toBe(true);
  });

  it('blocks anchor download for iPadOS desktop-UA with coarse pointer', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('pointer: coarse'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));
    expect(canUseAnchorDownload()).toBe(false);
  });

  it('shares then falls back to clipboard on iPad-like UA', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockRejectedValue(new Error('share failed'));
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
      platform: 'iPad',
      maxTouchPoints: 5,
      share,
      canShare: () => true,
      clipboard: { writeText },
    });
    expect(canUseAnchorDownload()).toBe(false);

    const result = await deliverBlob({
      blob: new Blob(['line1\nline2'], { type: 'text/plain' }),
      filename: 'log.txt',
      text: 'line1\nline2',
      title: 'Round log',
    });

    expect(share).toHaveBeenCalled();
    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('line1\nline2');
  });

  it('downloadBlobViaAnchor sets the filename', () => {
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:img');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    downloadBlobViaAnchor(new Blob(['x'], { type: 'image/png' }), 'board.png');
    expect(anchor.download).toBe('board.png');
    expect(click).toHaveBeenCalled();
  });
});
