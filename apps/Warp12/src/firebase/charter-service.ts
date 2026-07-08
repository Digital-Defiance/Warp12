import { callFunction } from './functions-client.js';
import { isFirebaseConfigured } from './config.js';

export type RatedObjective = 'go-out' | 'points';

export type CharterModulesView = {
  salamanderPenalty: boolean;
  qContinuum: boolean;
  subspaceFracture: boolean;
  subspaceFractureScope: 'own-trail' | 'all-captains' | 'all-doubles';
};

export type CharterHouseRulesView = {
  requireOwnTrailFirst: boolean;
  neutralZoneAfterAllTrails: boolean;
  beaconClearsOnAnyPlay: boolean;
  roundStarterPlaysTwo: boolean;
  dropToImpulseCall: boolean;
  dropToImpulseCatchPenalty: 1 | 2;
  allStopCeremony: boolean;
  passRedAlertWithoutDraw: boolean;
  manualShieldControl: boolean;
  doubleZeroScore: 0 | 25 | 50;
  largeFleetHandSize?: 10 | 11;
};

export interface PublicCharterView {
  charterId: string;
  slug: string;
  name: string;
  rulesProfileId: string;
  objective: RatedObjective;
  playerCount: number;
  campaignRounds: number;
  modules?: CharterModulesView;
  houseRules?: CharterHouseRulesView;
  isGlobalOfficial: boolean;
  createdAt: string;
}

export async function listMyCharters(): Promise<PublicCharterView[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }
  const result = await callFunction<Record<string, never>, { charters: PublicCharterView[] }>(
    'listMyCharters',
    {}
  );
  return result.charters ?? [];
}
