import { describe, expect, it } from 'vitest';

import { formatSectorTurnFooter } from './sector-status-hud.js';

describe('sector-status-hud', () => {
  it('describes your turn in the footer', () => {
    expect(
      formatSectorTurnFooter({
        game: { phase: 'active' } as never,
        round: { roundNumber: 2 } as never,
        names: { you: 'Picard' },
        activePlayerId: 'you',
        handOwnerId: 'you',
        isMyTurn: true,
        activePlayerIsAi: false,
        isOnline: false,
        syncPending: false,
        roundAwaitingScore: false,
        roundEndSummaryOpen: false,
        lastMessage: null,
      })
    ).toBe('Picard · your turn');
  });

  it('describes AI thinking in the footer', () => {
    expect(
      formatSectorTurnFooter({
        game: { phase: 'active' } as never,
        round: { roundNumber: 2 } as never,
        names: { ai: 'Data' },
        activePlayerId: 'ai',
        handOwnerId: 'you',
        isMyTurn: false,
        activePlayerIsAi: true,
        isOnline: false,
        syncPending: false,
        roundAwaitingScore: false,
        roundEndSummaryOpen: false,
        lastMessage: null,
      })
    ).toBe('Data is thinking…');
  });
});
