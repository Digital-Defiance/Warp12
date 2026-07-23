import { describe, expect, it } from 'vitest';

import {
  copyCustomPropertiesFromAncestors,
  formatShareRoundMessage,
  formatPointsStatLines,
  stripCaptureDecorations,
} from './share-round.js';

describe('share-round', () => {
  it('formats points stat lines like the round-end summary', () => {
    expect(formatPointsStatLines([])).toEqual(['No points held this round.']);
    expect(
      formatPointsStatLines([
        { name: 'Yeager', points: 12 },
        { name: 'Data', points: 8 },
      ])
    ).toEqual(['Yeager: +12 points', 'Data: +8 points']);
  });

  it('includes stats lines in share text', () => {
    const message = formatShareRoundMessage({
      roundNumber: 2,
      headline: 'Armstrong wins the round',
      statsLines: ['Armstrong: +12 points'],
    });
    expect(message).toContain('Armstrong wins the round');
    expect(message).toContain('Armstrong: +12 points');
    expect(message).toContain('https://warp.iwgf.org');
  });

  it('preserves stats in overlay mode messages', () => {
    const message = formatShareRoundMessage({
      roundNumber: 1,
      headline: 'Lovell wins the round',
      statsLines: ['Lovell: +8 points'],
    });
    expect(message).toContain('Lovell: +8 points');
  });

  it('joins headline and stats for share payload', () => {
    const message = formatShareRoundMessage({
      roundNumber: 3,
      headline: 'Sector blocked',
      statsLines: ['Armstrong: +12 points'],
    });
    expect(message.split('\n')).toEqual(
      expect.arrayContaining([
        'Sector blocked',
        'Armstrong: +12 points',
        'https://warp.iwgf.org',
      ])
    );
  });

  it('copies nearest ancestor custom properties onto the capture host', () => {
    const outer = document.createElement('div');
    outer.style.setProperty('--warp-table', '#050816');
    outer.style.setProperty('--warp-accent', '#38bdf8');
    const inner = document.createElement('div');
    inner.style.setProperty('--warp-accent', '#fbbf24');
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const host = document.createElement('div');
    copyCustomPropertiesFromAncestors(inner, host);

    expect(host.style.getPropertyValue('--warp-table')).toBe('#050816');
    expect(host.style.getPropertyValue('--warp-accent')).toBe('#fbbf24');
    outer.remove();
  });

  it('strips glow decorations that WebKit turns into blue ghosts', () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    child.style.boxShadow = '0 0 8px #38bdf8';
    child.style.filter = 'drop-shadow(0 0 6px #38bdf8)';
    root.appendChild(child);
    document.body.appendChild(root);

    stripCaptureDecorations(root);

    expect(child.style.getPropertyValue('box-shadow')).toBe('none');
    expect(child.style.getPropertyValue('filter')).toBe('none');
    root.remove();
  });

  it('hides tooltips and blocks pointer hit-testing on the capture clone', () => {
    const root = document.createElement('div');
    const badge = document.createElement('div');
    badge.style.pointerEvents = 'auto';
    const tip = document.createElement('span');
    tip.setAttribute('role', 'tooltip');
    tip.textContent = 'Armstrong · Commander';
    badge.appendChild(tip);
    root.appendChild(badge);
    document.body.appendChild(root);

    stripCaptureDecorations(root);

    expect(badge.style.getPropertyValue('pointer-events')).toBe('none');
    expect(tip.style.getPropertyValue('display')).toBe('none');
    root.remove();
  });
});
