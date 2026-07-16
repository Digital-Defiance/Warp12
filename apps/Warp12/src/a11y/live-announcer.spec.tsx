import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { LiveAnnouncerProvider, useAnnounce } from './live-announcer.js';

function Harness() {
  const announce = useAnnounce();
  return (
    <div>
      <button onClick={() => announce('Your turn', 'assertive')}>turn</button>
      <button onClick={() => announce('Armstrong played 6:3')}>play</button>
      <button onClick={() => announce('   ')}>blank</button>
    </div>
  );
}

function politeRegions(): HTMLElement[] {
  return screen
    .getAllByRole('status')
    .filter((el) => el.getAttribute('aria-live') === 'polite');
}

function assertiveRegions(): HTMLElement[] {
  return screen.getAllByRole('alert');
}

describe('LiveAnnouncer', () => {
  it('renders paired polite and assertive live regions', () => {
    render(
      <LiveAnnouncerProvider>
        <Harness />
      </LiveAnnouncerProvider>
    );
    expect(politeRegions()).toHaveLength(2);
    expect(assertiveRegions()).toHaveLength(2);
  });

  it('writes polite messages into a live region', () => {
    render(
      <LiveAnnouncerProvider>
        <Harness />
      </LiveAnnouncerProvider>
    );
    act(() => screen.getByText('play').click());
    const text = politeRegions()
      .map((el) => el.textContent)
      .join('');
    expect(text).toBe('Armstrong played 6:3');
  });

  it('routes assertive messages to the alert regions only', () => {
    render(
      <LiveAnnouncerProvider>
        <Harness />
      </LiveAnnouncerProvider>
    );
    act(() => screen.getByText('turn').click());
    expect(assertiveRegions().map((el) => el.textContent).join('')).toBe(
      'Your turn'
    );
    expect(politeRegions().map((el) => el.textContent).join('')).toBe('');
  });

  it('alternates nodes so a repeated message is re-announced', () => {
    render(
      <LiveAnnouncerProvider>
        <Harness />
      </LiveAnnouncerProvider>
    );
    act(() => screen.getByText('turn').click());
    const firstHolder = assertiveRegions().findIndex((el) => el.textContent);
    act(() => screen.getByText('turn').click());
    const secondHolder = assertiveRegions().findIndex((el) => el.textContent);
    expect(secondHolder).not.toBe(firstHolder);
  });

  it('ignores blank announcements', () => {
    render(
      <LiveAnnouncerProvider>
        <Harness />
      </LiveAnnouncerProvider>
    );
    act(() => screen.getByText('blank').click());
    const all = [...politeRegions(), ...assertiveRegions()]
      .map((el) => el.textContent)
      .join('');
    expect(all).toBe('');
  });
});
