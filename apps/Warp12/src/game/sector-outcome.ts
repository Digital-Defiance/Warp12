import type { GameState } from 'warp12-engine';
import { formatCampaignPoints } from 'warp12-engine';

export interface SectorStanding {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly label: string;
}

/** Campaign / sector victor once `game.phase === 'complete'`. */
export function sectorWinnerId(game: GameState): string | null {
  if (game.phase !== 'complete') {
    return null;
  }

  if (game.objective === 'go-out') {
    return game.round?.roundWinnerId ?? null;
  }

  let winner = game.captains[0];
  for (const captain of game.captains) {
    if (captain.pointsScore < winner.pointsScore) {
      winner = captain;
    }
  }
  return winner.id;
}

export function sectorWinnerName(
  game: GameState,
  names: Readonly<Record<string, string>>
): string {
  const winnerId = sectorWinnerId(game);
  if (!winnerId) {
    return 'Captain';
  }
  return names[winnerId] ?? winnerId;
}

export function sectorStandings(
  game: GameState,
  names: Readonly<Record<string, string>>,
  options?: {
    /**
     * Online go-out: private hands are cleared (or not mirrored) once the
     * sector completes. Prefer the public `handCounts` snapshot so final
     * standings still show every seat's remaining tiles.
     */
    readonly handCounts?: Readonly<Record<string, number>>;
  }
): readonly SectorStanding[] {
  if (game.objective === 'go-out') {
    const winnerId = sectorWinnerId(game);
    const handCounts = options?.handCounts;
    return game.captains.map((captain) => {
      const fromHand = (game.round?.hands[captain.id] ?? []).length;
      const tiles =
        handCounts != null ? (handCounts[captain.id] ?? fromHand) : fromHand;
      return {
        id: captain.id,
        name: names[captain.id] ?? captain.displayName,
        value: tiles,
        label:
          captain.id === winnerId
            ? 'Winner · empty hand'
            : `${tiles} tile(s) left`,
      };
    });
  }

  return [...game.captains]
    .map((captain) => ({
      id: captain.id,
      name: names[captain.id] ?? captain.displayName,
      value: captain.pointsScore,
      label: formatCampaignPoints(captain.pointsScore),
    }))
    .sort((left, right) => left.value - right.value);
}

export function sectorCompleteHeadline(
  game: GameState,
  names: Readonly<Record<string, string>>,
  humanId?: string
): string {
  const winner = sectorWinnerName(game, names);
  if (game.objective === 'go-out') {
    return `${winner} goes out first and wins the sector.`;
  }
  if (humanId && sectorWinnerId(game) === humanId) {
    return `You win the ${game.campaignRounds}-round campaign with the lowest points total.`;
  }
  if (humanId && sectorWinnerId(game) !== humanId) {
    return `${winner} wins the ${game.campaignRounds}-round campaign.`;
  }
  return `${winner} wins the campaign — lowest points total.`;
}
