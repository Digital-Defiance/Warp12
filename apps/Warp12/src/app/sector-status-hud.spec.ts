import { describe, expect, it } from 'vitest';

import {
  formatSectorTurnFooter,
  sectorTurnFooterText,
  shouldShowAiThinking,
} from './sector-status-hud.js';

describe('sector-status-hud', () => {
  it('describes your turn in the footer', () => {
    expect(
      sectorTurnFooterText(
        formatSectorTurnFooter({
          game: {
            phase: 'active',
            objective: 'points',
            campaignRounds: 5,
          } as never,
          round: { roundNumber: 2 } as never,
          names: { you: 'Armstrong' },
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
      )
    ).toBe('Armstrong · your turn');
  });

  it('colors the helm captain id for your-turn footers', () => {
    const footer = formatSectorTurnFooter({
      game: { phase: 'active', objective: 'points', campaignRounds: 5 } as never,
      round: { roundNumber: 2 } as never,
      names: { you: 'Armstrong' },
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
    });
    expect(footer).toEqual({
      kind: 'named',
      captainId: 'you',
      name: 'Armstrong',
      rest: ' · your turn',
    });
  });

  it('describes AI thinking for local play and the online host', () => {
    expect(
      sectorTurnFooterText(
        formatSectorTurnFooter({
          game: {
            phase: 'active',
            objective: 'go-out',
            campaignRounds: 13,
          } as never,
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
      )
    ).toBe('Data is thinking…');

    expect(
      sectorTurnFooterText(
        formatSectorTurnFooter({
          game: {
            phase: 'active',
            objective: 'points',
            campaignRounds: 3,
          } as never,
          round: { roundNumber: 2 } as never,
          names: { 'ai:lovell': 'Lovell' },
          activePlayerId: 'ai:lovell',
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
      )
    ).toBe('Lovell is thinking…');
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
      sectorTurnFooterText(
        formatSectorTurnFooter({
          game: {
            phase: 'active',
            objective: 'points',
            campaignRounds: 3,
          } as never,
          round: { roundNumber: 2 } as never,
          names: { 'ai:lovell': 'Lovell' },
          activePlayerId: 'ai:lovell',
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
      )
    ).toBe('Awaiting Lovell');
  });
});
