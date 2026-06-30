/** Tiles drawn when an opponent catches a missed Drop to Impulse announce. */
export type DropToImpulseCatchPenalty = 1 | 2;

/** Optional house-rule toggles for tournament hosts (default = standard Mexican Train). */
export interface HouseRules {
  /** Deluxe-style: must chart on your warp trail before an opponent's open trail. */
  readonly requireOwnTrailFirst: boolean;
  /** Deluxe-style: Neutral Zone cannot start until every captain has a tile on their trail. */
  readonly neutralZoneAfterAllTrails: boolean;
  /** Deluxe-style: any chart removes your Distress Beacon (not only your own trail). */
  readonly beaconClearsOnAnyPlay: boolean;
  /** Deluxe-style: round starter must chart two tiles on their own trail before helm passes. */
  readonly roundStarterPlaysTwo: boolean;
  /** Announce Drop to Impulse when one coordinate remains (uno / knock). */
  readonly dropToImpulseCall: boolean;
  /** Draw penalty when caught forgetting to announce (1 = standard; 2 = house rule). */
  readonly dropToImpulseCatchPenalty: DropToImpulseCatchPenalty;
  /** Auto All Stop! log/sound after Neutral Zone wins and All Stop! echo go-outs. */
  readonly allStopCeremony: boolean;
}

export interface HouseRulesConfig {
  requireOwnTrailFirst?: boolean;
  neutralZoneAfterAllTrails?: boolean;
  beaconClearsOnAnyPlay?: boolean;
  roundStarterPlaysTwo?: boolean;
  dropToImpulseCall?: boolean;
  dropToImpulseCatchPenalty?: DropToImpulseCatchPenalty;
  allStopCeremony?: boolean;
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
  requireOwnTrailFirst: false,
  neutralZoneAfterAllTrails: false,
  beaconClearsOnAnyPlay: false,
  roundStarterPlaysTwo: false,
  dropToImpulseCall: false,
  dropToImpulseCatchPenalty: 1,
  allStopCeremony: true,
};

export function resolveHouseRules(
  config: HouseRulesConfig = {}
): HouseRules {
  return {
    requireOwnTrailFirst: config.requireOwnTrailFirst ?? false,
    neutralZoneAfterAllTrails: config.neutralZoneAfterAllTrails ?? false,
    beaconClearsOnAnyPlay: config.beaconClearsOnAnyPlay ?? false,
    roundStarterPlaysTwo: config.roundStarterPlaysTwo ?? false,
    dropToImpulseCall: config.dropToImpulseCall ?? false,
    dropToImpulseCatchPenalty:
      config.dropToImpulseCatchPenalty === 2 ? 2 : 1,
    allStopCeremony: config.allStopCeremony ?? true,
  };
}
