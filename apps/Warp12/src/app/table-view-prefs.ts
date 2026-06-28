export type CaptainTailsDisplay = 'number' | 'domino';

const ENABLED_KEY = 'warp12-captain-tails-hud';
const DISPLAY_KEY = 'warp12-captain-tails-display';

export function readCaptainTailsHudEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeCaptainTailsHudEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(ENABLED_KEY, 'true');
    } else {
      localStorage.removeItem(ENABLED_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function readCaptainTailsDisplay(): CaptainTailsDisplay {
  try {
    const value = localStorage.getItem(DISPLAY_KEY);
    if (value === 'number' || value === 'domino') {
      return value;
    }
  } catch {
    return 'number';
  }
  return 'number';
}

export function writeCaptainTailsDisplay(display: CaptainTailsDisplay): void {
  try {
    localStorage.setItem(DISPLAY_KEY, display);
  } catch {
    // ignore quota / private mode
  }
}
