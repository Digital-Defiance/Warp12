import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DEFAULT_GAME_OBJECTIVE,
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  type GameModuleConfig,
  type GameObjective,
  type HouseRulesConfig,
} from 'warp12-engine';

import type { CreateLobbyOptions } from '../firebase/index.js';

/** Label for the encouraged Warp 12 rules bundle in setup screens. */
export const WARP12_OFFICIAL_RULES_LABEL = 'Official Warp 12 rules';

/** Thirteen-round points campaign — standard Warp 12 scoring. */
export const WARP12_OFFICIAL_OBJECTIVE: GameObjective = DEFAULT_GAME_OBJECTIVE;

export const WARP12_OFFICIAL_CAMPAIGN_ROUNDS = DEFAULT_CAMPAIGN_ROUNDS;

/** Module Alpha + Beta enabled; Subspace Fracture off unless hosts opt in. */
export const WARP12_OFFICIAL_MODULES: Readonly<GameModuleConfig> = {
  salamanderPenalty: true,
  continuum: true,
  subspaceFracture: false,
  subspaceFractureScope: DEFAULT_SUBSPACE_FRACTURE_SCOPE,
};

/** Drop to Impulse with a one-tile catch; All Stop! ceremony on. Deluxe/family extras off. */
export const WARP12_OFFICIAL_HOUSE_RULES: Readonly<HouseRulesConfig> = {
  dropToImpulseCall: true,
  dropToImpulseCatchPenalty: 1,
  allStopCeremony: true,
  requireOwnTrailFirst: false,
  neutralZoneAfterAllTrails: false,
  beaconClearsOnAnyPlay: false,
  roundStarterPlaysTwo: false,
  passRedAlertWithoutDraw: false,
  manualShieldControl: false,
  // Warp 12 keeps the double-blank safe to hold (it triggers Continuum),
  // unlike the tournament-standard 50.
  doubleZeroScore: 0,
};

export const WARP12_OFFICIAL_RULES_SUMMARY =
  'Points campaign, Salamander penalty, Continuum, Drop to Impulse (1-tile catch), and All Stop! ceremony.';

/** Default online create options — Official Warp 12 rules encouraged at launch. */
export function warp12OfficialCreateLobbyOptions(
  overrides: Partial<CreateLobbyOptions> = {}
): CreateLobbyOptions {
  return {
    objective: WARP12_OFFICIAL_OBJECTIVE,
    maxPlayers: 4,
    campaignRounds: WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
    ...overrides,
    modules: { ...WARP12_OFFICIAL_MODULES, ...overrides.modules },
    houseRules: { ...WARP12_OFFICIAL_HOUSE_RULES, ...overrides.houseRules },
  };
}
