import type {
  RatedMatchCertificate,
  RatedMatchCertificatePlayer,
  RatedObjective,
  StoredRating,
} from './rated-match-schema.js';

export interface CertificateCharterInput {
  charterId: string;
  name: string;
  slug: string;
  rulesProfileId: string;
  playerCount: number;
  campaignRounds: number;
  seasonLabel?: string;
}

export interface CertificatePlayerInput {
  uid: string;
  displayName: string;
  rank: number;
  score: number;
  ratingBefore: StoredRating;
  ratingAfter: StoredRating;
  charterId?: string;
  globalRatingBefore?: StoredRating;
  globalRatingAfter?: StoredRating;
}

export function buildCertificatePlayer(
  input: CertificatePlayerInput
): RatedMatchCertificatePlayer {
  const muDelta = input.ratingAfter.mu - input.ratingBefore.mu;

  const player: RatedMatchCertificatePlayer = {
    uid: input.uid,
    displayName: input.displayName,
    rank: input.rank,
    score: input.score,
  };

  if (input.charterId) {
    // Charter/crew match
    player.crewRatingBefore = input.ratingBefore;
    player.crewRatingAfter = input.ratingAfter;
    player.crewMuDelta = muDelta;
    if (input.globalRatingBefore && input.globalRatingAfter) {
      // Also track global human pool rating if available
      player.humanRatingBefore = input.globalRatingBefore;
      player.humanRatingAfter = input.globalRatingAfter;
      player.humanMuDelta =
        input.globalRatingAfter.mu - input.globalRatingBefore.mu;
    }
  } else {
    // Human pool match
    player.humanRatingBefore = input.ratingBefore;
    player.humanRatingAfter = input.ratingAfter;
    player.humanMuDelta = muDelta;
  }

  return player;
}

export function buildRatedMatchCertificate(input: {
  matchCode: string;
  issuedAt: string;
  objective: RatedObjective;
  charter?: CertificateCharterInput;
  players: RatedMatchCertificatePlayer[];
}): RatedMatchCertificate {
  return {
    version: 1,
    matchCode: input.matchCode,
    issuedAt: input.issuedAt,
    objective: input.objective,
    ...(input.charter ? { charter: input.charter } : {}),
    players: input.players,
  };
}

