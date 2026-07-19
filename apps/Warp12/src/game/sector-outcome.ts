import type { GameState } from 'warp12-engine';
import { formatCampaignPoints } from 'warp12-engine';

export interface SectorStanding {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly label: string;
}

/** True when this go-out sector is a multi-round campaign (not sudden-death). */
function isGoOutCampaign(game: GameState): boolean {
  return (
    game.objective === 'go-out' &&
    game.goOutStructure != null &&
    game.goOutStructure !== 'sudden-death'
  );
}

/** Campaign / sector victor once `game.phase === 'complete'`. */
export function sectorWinnerId(game: GameState): string | null {
  if (game.phase !== 'complete') {
    return null;
  }

  if (game.objective === 'go-out') {
    if (!isGoOutCampaign(game)) {
      // Sudden-death: the round winner is the sector winner.
      return game.round?.roundWinnerId ?? null;
    }
    // Multi-round campaign: captain with the most goOutWins wins.
    // If tied (overtime declined), return null.
    let best: typeof game.captains[number] | null = null;
    let tied = false;
    for (const captain of game.captains) {
      const wins = captain.goOutWins ?? 0;
      if (!best) {
        best = captain;
      } else {
        const bestWins = best.goOutWins ?? 0;
        if (wins > bestWins) {
          best = captain;
          tied = false;
        } else if (wins === bestWins) {
          tied = true;
        }
      }
    }
    return tied ? null : (best?.id ?? null);
  }

  let winner = game.captains[0];
  for (const captain of game.captains) {
    if (captain.pointsScore < (winner?.pointsScore ?? Infinity)) {
      winner = captain;
    }
  }
  return winner?.id ?? null;
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
    if (isGoOutCampaign(game)) {
      // Multi-round campaign: rank by round wins.
      const winnerId = sectorWinnerId(game);
      return [...game.captains]
        .map((captain) => {
          const wins = captain.goOutWins ?? 0;
          return {
            id: captain.id,
            name: names[captain.id] ?? captain.displayName,
            value: wins,
            label:
              captain.id === winnerId
                ? `Winner · ${wins} win${wins === 1 ? '' : 's'}`
                : `${wins} win${wins === 1 ? '' : 's'}`,
          };
        })
        .sort((left, right) => right.value - left.value);
    }

    // Sudden-death: tile count standings.
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
    if (!isGoOutCampaign(game)) {
      return `${winner} goes out first and wins the sector.`;
    }
    const winnerId = sectorWinnerId(game);
    if (!winnerId) {
      // Tied / overtime declined.
      return 'The sector ends tied — no single victor.';
    }
    const wins = game.captains.find((c) => c.id === winnerId)?.goOutWins ?? 0;
    const structure = game.goOutStructure;
    if (humanId && winnerId === humanId) {
      return structure === 'first-to'
        ? `You reach ${wins} win${wins === 1 ? '' : 's'} first and take the sector!`
        : `You win the ${game.campaignRounds}-round campaign with the most go-out wins.`;
    }
    return structure === 'first-to'
      ? `${winner} reaches ${wins} win${wins === 1 ? '' : 's'} first and takes the sector.`
      : `${winner} wins the ${game.campaignRounds}-round campaign with the most go-out wins.`;
  }
  if (humanId && sectorWinnerId(game) === humanId) {
    return `You win the ${game.campaignRounds}-round campaign with the lowest points total.`;
  }
  if (humanId && sectorWinnerId(game) !== humanId) {
    return `${winner} wins the ${game.campaignRounds}-round campaign.`;
  }
  return `${winner} wins the campaign — lowest points total.`;
}
