import {
  DEFAULT_LARGE_FLEET_HAND_SIZE,
  type LargeFleetHandSize,
} from '../constants/setup.js';

export type { LargeFleetHandSize } from '../constants/setup.js';

/** Tiles drawn when an opponent catches a missed Drop to Impulse announce. */
export type DropToImpulseCatchPenalty = 1 | 2;

/** Points a double-blank (0-0) scores when caught in hand. 50 = tournament standard. */
export type DoubleZeroScore = 0 | 25 | 50;

/** Optional house-rule toggles for tournament hosts (default = standard multi-trail). */
export interface HouseRules {
  /** Deluxe-style: must chart on your warp trail before an opponent's open trail. */
  readonly requireOwnTrailFirst: boolean;
  /** Deluxe-style: Neutral Zone cannot start until every captain has a tile on their trail. */
  readonly neutralZoneAfterAllTrails: boolean;
  /** Deluxe-style: any chart removes your Distress Beacon (not only your own trail). */
  readonly beaconClearsOnAnyPlay: boolean;
  /** Round starter must chart two tiles before helm passes (can be on any legal route). */
  readonly roundStarterPlaysTwo: boolean;
  /** When roundStarterPlaysTwo is enabled, restrict both tiles to own trail only (Deluxe variant). */
  readonly roundStarterOwnTrailOnly: boolean;
  /** Announce Drop to Impulse when one coordinate remains (uno / knock). */
  readonly dropToImpulseCall: boolean;
  /** Draw penalty when caught forgetting to announce (1 = standard; 2 = house rule). */
  readonly dropToImpulseCatchPenalty: DropToImpulseCatchPenalty;
  /** Auto All Stop! log/sound after Neutral Zone wins and All Stop! echo go-outs. */
  readonly allStopCeremony: boolean;
  /** Pass Red Alert without drawing or deploying a Distress Beacon when you cannot cover the double. */
  readonly passRedAlertWithoutDraw: boolean;
  /** Voluntary shields down/up; own-trail charts do not auto-raise. Forced beacon after draw when stuck still applies. */
  readonly manualShieldControl: boolean;
  /** Points a double-blank (0-0) scores when caught in hand (50 = tournament standard). */
  readonly doubleZeroScore: DoubleZeroScore;
  /** Hand size for 7–8 captains (10 = Warp 12 default; 11 = Galt/University). */
  readonly largeFleetHandSize: LargeFleetHandSize;
}

export interface HouseRulesConfig {
  requireOwnTrailFirst?: boolean;
  neutralZoneAfterAllTrails?: boolean;
  beaconClearsOnAnyPlay?: boolean;
  roundStarterPlaysTwo?: boolean;
  roundStarterOwnTrailOnly?: boolean;
  dropToImpulseCall?: boolean;
  dropToImpulseCatchPenalty?: DropToImpulseCatchPenalty;
  allStopCeremony?: boolean;
  passRedAlertWithoutDraw?: boolean;
  manualShieldControl?: boolean;
  doubleZeroScore?: DoubleZeroScore;
  largeFleetHandSize?: LargeFleetHandSize;
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
  requireOwnTrailFirst: false,
  neutralZoneAfterAllTrails: false,
  beaconClearsOnAnyPlay: false,
  roundStarterPlaysTwo: false,
  roundStarterOwnTrailOnly: false,
  dropToImpulseCall: false,
  dropToImpulseCatchPenalty: 1,
  allStopCeremony: true,
  passRedAlertWithoutDraw: false,
  manualShieldControl: false,
  doubleZeroScore: 50,
  largeFleetHandSize: DEFAULT_LARGE_FLEET_HAND_SIZE,
};

/** Normalize an arbitrary value to a supported double-zero score (default 50). */
function resolveDoubleZeroScore(value: DoubleZeroScore | undefined): DoubleZeroScore {
  return value === 0 || value === 25 ? value : 50;
}

/** Normalize the large-fleet hand size (only 11 opts out of the default 10). */
function resolveLargeFleetHandSize(
  value: LargeFleetHandSize | undefined
): LargeFleetHandSize {
  return value === 11 ? 11 : DEFAULT_LARGE_FLEET_HAND_SIZE;
}

export function resolveHouseRules(
  config: HouseRulesConfig = {}
): HouseRules {
  return {
    requireOwnTrailFirst: config.requireOwnTrailFirst ?? false,
    neutralZoneAfterAllTrails: config.neutralZoneAfterAllTrails ?? false,
    beaconClearsOnAnyPlay: config.beaconClearsOnAnyPlay ?? false,
    roundStarterPlaysTwo: config.roundStarterPlaysTwo ?? false,
    roundStarterOwnTrailOnly: config.roundStarterOwnTrailOnly ?? false,
    dropToImpulseCall: config.dropToImpulseCall ?? false,
    dropToImpulseCatchPenalty:
      config.dropToImpulseCatchPenalty === 2 ? 2 : 1,
    allStopCeremony: config.allStopCeremony ?? true,
    passRedAlertWithoutDraw: config.passRedAlertWithoutDraw ?? false,
    manualShieldControl: config.manualShieldControl ?? false,
    doubleZeroScore: resolveDoubleZeroScore(config.doubleZeroScore),
    largeFleetHandSize: resolveLargeFleetHandSize(config.largeFleetHandSize),
  };
}
