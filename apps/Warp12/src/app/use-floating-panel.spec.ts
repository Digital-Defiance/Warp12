import { describe, expect, it } from 'vitest';

import { isPanelDragExemptTarget } from './use-floating-panel.js';

describe('isPanelDragExemptTarget', () => {
  it('exempts buttons and nested control content', () => {
    const button = document.createElement('button');
    const span = document.createElement('span');
    button.appendChild(span);
    document.body.appendChild(button);
    expect(isPanelDragExemptTarget(span)).toBe(true);
    expect(isPanelDragExemptTarget(button)).toBe(true);
    button.remove();
  });

  it('exempts the resize handle via data-no-panel-drag', () => {
    const handle = document.createElement('div');
    handle.setAttribute('data-no-panel-drag', '');
    document.body.appendChild(handle);
    expect(isPanelDragExemptTarget(handle)).toBe(true);
    handle.remove();
  });

  it('allows ordinary panel content', () => {
    const row = document.createElement('li');
    document.body.appendChild(row);
    expect(isPanelDragExemptTarget(row)).toBe(false);
    row.remove();
  });
});
