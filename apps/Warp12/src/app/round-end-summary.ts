import { summarizeRoundOutcome, type GameState, type RoundState } from 'warp12-engine';

/**
 * Round-end ceremony copy. Kept pure and separate from the table component so
 * the inverted-round wording (Module Kappa) can be unit-tested directly.
 *
 * Going out (emptying your hand) and winning the round are the same event on a
 * normal round, but opposite under Kappa inversion — where going out is the
 * catastrophic play and the highest hand wins. These helpers make that explicit
 * so the ceremony never implies the go-out captain did something good.
 */
export function roundEndTitle(
  game: GameState,
  round: RoundState,
  names: Record<string, string>
): string {
  if (round.roundBlocked) {
    return 'Sector blocked';
  }
  const outcome = summarizeRoundOutcome(game, round);
  const wentOut = names[outcome.wentOutId ?? ''] ?? 'Captain';
  if (outcome.inverted) {
    return `${wentOut} goes out — inverted round`;
  }
  return `${wentOut} wins the round`;
}

export function roundEndHeadline(
  game: GameState,
  round: RoundState,
  names: Record<string, string>
): string {
  if (round.roundBlocked) {
    return `Round ${round.roundNumber} blocked — no legal charts remain.`;
  }
  const outcome = summarizeRoundOutcome(game, round);
  const wentOut = names[outcome.wentOutId ?? ''] ?? 'Captain';
  if (outcome.inverted) {
    const trophy = outcome.roundWinnerIds
      .filter((id) => id !== outcome.wentOutId)
      .map((id) => names[id] ?? 'Captain');
    const takes =
      trophy.length > 0
        ? `${trophy.join(' & ')} take${trophy.length > 1 ? '' : 's'} the round by holding the most`
        : 'the highest hand takes the round';
    return `Inverted round — going out backfires on ${wentOut}. ${takes}.`;
  }
  return `${wentOut} charts the final coordinate.`;
}
