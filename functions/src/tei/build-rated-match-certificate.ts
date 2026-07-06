import type {
  RatedMatchCertificate,
  RatedMatchCertificatePlayer,
  RatedObjective,
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
  teiBefore: number;
  teiAfter: number;
  charterId?: string;
  globalTeiBefore?: number;
  globalTeiAfter?: number;
}

export function buildCertificatePlayer(
  input: CertificatePlayerInput
): RatedMatchCertificatePlayer {
  const player: RatedMatchCertificatePlayer = {
    uid: input.uid,
    displayName: input.displayName,
    rank: input.rank,
    score: input.score,
  };

  if (input.charterId) {
    player.crewTeiBefore = input.teiBefore;
    player.crewTeiAfter = input.teiAfter;
    player.crewTeiDelta = input.teiAfter - input.teiBefore;
    if (
      input.globalTeiBefore !== undefined &&
      input.globalTeiAfter !== undefined
    ) {
      player.globalTeiBefore = input.globalTeiBefore;
      player.globalTeiAfter = input.globalTeiAfter;
      player.globalTeiDelta = input.globalTeiAfter - input.globalTeiBefore;
    }
  } else {
    player.humanTeiBefore = input.teiBefore;
    player.humanTeiAfter = input.teiAfter;
    player.humanTeiDelta = input.teiAfter - input.teiBefore;
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
