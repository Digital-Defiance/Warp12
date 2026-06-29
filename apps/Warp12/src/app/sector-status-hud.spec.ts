import { describe, expect, it } from 'vitest';

import {
  formatSectorTurnFooter,
  shouldShowAiThinking,
} from './sector-status-hud.js';

describe('sector-status-hud', () => {
  it('describes your turn in the footer', () => {
    expect(
      formatSectorTurnFooter({
        game: { phase: 'active', objective: 'penalty', campaignRounds: 5 } as never,
        round: { roundNumber: 2 } as never,
        names: { you: 'Picard' },
        activePlayerId: 'you',
        handOwnerId: 'you',
        isMyTurn: true,
        activePlayerIsAi: false,
        isOnline: false,
        isOnlineHost: false,
        syncPending: false,
        roundAwaitingScore: false,
        roundEndSummaryOpen: false,
        lastMessage: null,
      })
    ).toBe('Picard · your turn');
  });

  it('describes AI thinking for local play and the online host', () => {
    expect(
      formatSectorTurnFooter({
        game: { phase: 'active', objective: 'go-out', campaignRounds: 13 } as never,
        round: { roundNumber: 2 } as never,
        names: { ai: 'Data' },
        activePlayerId: 'ai',
        handOwnerId: 'you',
        isMyTurn: false,
        activePlayerIsAi: true,
        isOnline: false,
        isOnlineHost: false,
        syncPending: false,
        roundAwaitingScore: false,
        roundEndSummaryOpen: false,
        lastMessage: null,
      })
    ).toBe('Data is thinking…');

    expect(
      formatSectorTurnFooter({
        game: { phase: 'active', objective: 'penalty', campaignRounds: 3 } as never,
        round: { roundNumber: 2 } as never,
        names: { 'ai:riker': 'Riker' },
        activePlayerId: 'ai:riker',
        handOwnerId: 'host',
        isMyTurn: false,
        activePlayerIsAi: true,
        isOnline: true,
        isOnlineHost: true,
        syncPending: false,
        roundAwaitingScore: false,
        roundEndSummaryOpen: false,
        lastMessage: null,
      })
    ).toBe('Riker is thinking…');
  });

  it('shows awaiting for online guests during an AI turn', () => {
    expect(
      shouldShowAiThinking({
        activePlayerIsAi: true,
        isOnline: true,
        isOnlineHost: false,
      })
    ).toBe(false);

    expect(
      formatSectorTurnFooter({
        game: { phase: 'active', objective: 'penalty', campaignRounds: 3 } as never,
        round: { roundNumber: 2 } as never,
        names: { 'ai:riker': 'Riker' },
        activePlayerId: 'ai:riker',
        handOwnerId: 'guest',
        isMyTurn: false,
        activePlayerIsAi: true,
        isOnline: true,
        isOnlineHost: false,
        syncPending: false,
        roundAwaitingScore: false,
        roundEndSummaryOpen: false,
        lastMessage: null,
      })
    ).toBe('Awaiting Riker');
  });
});
