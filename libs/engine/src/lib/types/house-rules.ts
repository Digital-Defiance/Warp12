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
}

export interface HouseRulesConfig {
  requireOwnTrailFirst?: boolean;
  neutralZoneAfterAllTrails?: boolean;
  beaconClearsOnAnyPlay?: boolean;
  roundStarterPlaysTwo?: boolean;
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
  requireOwnTrailFirst: false,
  neutralZoneAfterAllTrails: false,
  beaconClearsOnAnyPlay: false,
  roundStarterPlaysTwo: false,
};

export function resolveHouseRules(
  config: HouseRulesConfig = {}
): HouseRules {
  return {
    requireOwnTrailFirst: config.requireOwnTrailFirst ?? false,
    neutralZoneAfterAllTrails: config.neutralZoneAfterAllTrails ?? false,
    beaconClearsOnAnyPlay: config.beaconClearsOnAnyPlay ?? false,
    roundStarterPlaysTwo: config.roundStarterPlaysTwo ?? false,
  };
}
