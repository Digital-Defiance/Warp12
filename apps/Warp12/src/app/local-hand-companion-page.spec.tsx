import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LiveAnnouncerProvider } from '../a11y/live-announcer.js';
import {
  HAND_COMPANION_CHANNEL,
  handCompanionChannelForSeat,
  publishHandCompanionSnapshot,
  type HandCompanionSnapshotMessage,
} from './hand-companion-broadcast.js';
import { LocalHandCompanionPage } from './local-hand-companion-page.js';

type Listener = (event: MessageEvent) => void;

function installBroadcastBus() {
  const buses = new Map<string, Set<Listener>>();

  class MockBroadcastChannel {
    readonly name: string;
    private readonly listeners = new Set<Listener>();

    constructor(name: string) {
      this.name = name;
      let set = buses.get(name);
      if (!set) {
        set = new Set();
        buses.set(name, set);
      }
      set.add(this.dispatch);
    }

    private readonly dispatch: Listener = (event) => {
      for (const listener of this.listeners) {
        listener(event);
      }
    };

    addEventListener(type: string, listener: Listener) {
      if (type === 'message') {
        this.listeners.add(listener);
      }
    }

    removeEventListener(type: string, listener: Listener) {
      if (type === 'message') {
        this.listeners.delete(listener);
      }
    }

    postMessage(data: unknown) {
      const peers = buses.get(this.name);
      if (!peers) {
        return;
      }
      const event = { data } as MessageEvent;
      for (const peer of peers) {
        if (peer !== this.dispatch) {
          peer(event);
        }
      }
      // Also deliver to this channel's own listeners (same-window pattern).
      for (const listener of this.listeners) {
        listener(event);
      }
    }

    close() {
      this.listeners.clear();
      buses.get(this.name)?.delete(this.dispatch);
    }
  }

  vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  return buses;
}

const emptyHelm = {
  showDraw: false,
  showDesperationDig: false,
  showShieldsDown: false,
  showShieldsUp: false,
  showPassRedAlert: false,
  showPass: false,
} as const;

function baseSnapshot(
  partial: Partial<HandCompanionSnapshotMessage> & {
    readonly handOwnerId: string;
    readonly handOwnerName: string;
  }
): Omit<HandCompanionSnapshotMessage, 'type' | 'at'> {
  return {
    gameId: 'local-1',
    maxPip: 12,
    isMyTurn: false,
    phase: 'active',
    status: 'Stand by for helm',
    hand: [{ low: 3, high: 5 }],
    legalMoves: [],
    helm: emptyHelm,
    spoolOptions: [],
    dropToImpulsePending: false,
    canCatchDropToImpulse: false,
    dropToImpulseCatchTargetId: null,
    dropToImpulseCatchLabel: null,
    names: {
      'human:0': 'Armstrong',
      'human:1': 'Lovell',
    },
    game: null,
    tileBg: 'dark',
    handoffPending: false,
    handoffCaptainName: null,
    ...partial,
  };
}

function renderSeat(path: string) {
  return render(
    <LiveAnnouncerProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/local/hand" element={<LocalHandCompanionPage />} />
          <Route
            path="/local/hand/:seatId"
            element={<LocalHandCompanionPage />}
          />
        </Routes>
      </MemoryRouter>
    </LiveAnnouncerProvider>
  );
}

describe('LocalHandCompanionPage', () => {
  beforeEach(() => {
    installBroadcastBus();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('locks to a seat channel and ignores other seats snapshots', async () => {
    renderSeat('/local/hand/human%3A0');

    await waitFor(() => {
      expect(screen.getByText(/Waiting for Bridge/i)).toBeTruthy();
    });

    act(() => {
      publishHandCompanionSnapshot(
        baseSnapshot({
          handOwnerId: 'human:1',
          handOwnerName: 'Lovell',
          status: 'Wrong seat',
        }),
        handCompanionChannelForSeat('human:0')
      );
    });

    expect(screen.queryByText('Lovell · Stand by')).toBeNull();

    act(() => {
      publishHandCompanionSnapshot(
        baseSnapshot({
          handOwnerId: 'human:0',
          handOwnerName: 'Armstrong',
          status: 'Select a playable coordinate',
          isMyTurn: true,
          legalMoves: [
            {
              coordinate: { low: 3, high: 5 },
              route: { kind: 'neutral-zone' },
            },
          ],
        }),
        handCompanionChannelForSeat('human:0')
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Armstrong · Your turn/i)).toBeTruthy();
    });
    expect(screen.getByRole('list', { name: /1 coordinates in hand/i })).toBeTruthy();
  });

  it('posts helm actions on the locked seat channel', async () => {
    const posts: { channel: string; data: unknown }[] = [];
    const Original = globalThis.BroadcastChannel;
    vi.stubGlobal(
      'BroadcastChannel',
      class extends (Original as typeof BroadcastChannel) {
        override postMessage(data: unknown) {
          posts.push({ channel: this.name, data });
          super.postMessage(data);
        }
      }
    );

    renderSeat('/local/hand/human%3A0');

    act(() => {
      publishHandCompanionSnapshot(
        baseSnapshot({
          handOwnerId: 'human:0',
          handOwnerName: 'Armstrong',
          isMyTurn: true,
          status: 'Draw or pass',
          helm: { ...emptyHelm, showDraw: true },
        }),
        handCompanionChannelForSeat('human:0')
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Draw' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Draw' }));

    expect(
      posts.some(
        (post) =>
          post.channel === handCompanionChannelForSeat('human:0') &&
          (post.data as { type?: string; action?: { type?: string } }).type ===
            'action' &&
          (post.data as { action?: { type?: string } }).action?.type ===
            'DRAW_FROM_UNCHARTED'
      )
    ).toBe(true);
  });

  it('shows seat picker on follow mode when roster has multiple seats', async () => {
    renderSeat('/local/hand');

    act(() => {
      const channel = new BroadcastChannel(HAND_COMPANION_CHANNEL);
      channel.postMessage({
        type: 'roster',
        gameId: 'local-1',
        seats: [
          { id: 'human:0', displayName: 'Armstrong' },
          { id: 'human:1', displayName: 'Lovell' },
        ],
      });
      channel.close();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('navigation', { name: /locked seat hand/i })
      ).toBeTruthy();
    });
    expect(
      screen.getByRole('link', { name: 'Armstrong' }).getAttribute('href')
    ).toBe('/local/hand/human%3A0');
  });

  it('keeps tile selection across snapshot republishes', async () => {
    const { container } = renderSeat('/local/hand/human%3A0');

    const snap = baseSnapshot({
      handOwnerId: 'human:0',
      handOwnerName: 'Armstrong',
      isMyTurn: true,
      status: 'Select a playable coordinate',
      legalMoves: [
        {
          coordinate: { low: 3, high: 5 },
          route: { kind: 'neutral-zone' },
        },
      ],
    });

    act(() => {
      publishHandCompanionSnapshot(
        snap,
        handCompanionChannelForSeat('human:0')
      );
    });

    await waitFor(() => {
      expect(
        container.querySelector('button[data-playable="true"]')
      ).toBeTruthy();
    });

    fireEvent.click(
      container.querySelector('button[data-playable="true"]') as HTMLElement
    );
    expect(screen.getByRole('button', { name: /Play on Neutral zone/i })).toBeTruthy();

    act(() => {
      publishHandCompanionSnapshot(
        { ...snap, status: 'Select a playable coordinate (refreshed)' },
        handCompanionChannelForSeat('human:0')
      );
    });

    expect(screen.getByRole('button', { name: /Play on Neutral zone/i })).toBeTruthy();
  });
});
