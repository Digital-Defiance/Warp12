/** Frozen lobby settings stored on a crew charter (Firestore game-doc shape). */

export type CharterSubspaceFractureScope =
  | 'own-trail'
  | 'all-captains'
  | 'all-doubles';

export interface CharterModulesConfig {
  salamanderPenalty: boolean;
  continuum: boolean;
  subspaceFracture: boolean;
  subspaceFractureScope: CharterSubspaceFractureScope;
  // Rated modules (Gamma, Delta, Eta, Theta, Iota)
  sensorGrid: boolean;
  sensorGridSize?: number;
  warpDriveSpool: boolean;
  temporalDebt: boolean;
  temporalDebtCostPerToken?: number;
  longestTrail: boolean;
  longestTrailBonus?: number;
  doubleDown: boolean;
  doubleDownDrawCount?: number;
  /** Module Zeta — online crew play; Squad TEI when rated (never FFA). */
  squadrons: boolean;
  squadronSize?: number;
  // Warped / exhibition (Epsilon, Kappa, Lambda) — never rate
  drafting: boolean;
  temporalInversion: boolean;
  wormholes: boolean;
}

export type CharterDropToImpulseCatchPenalty = 1 | 2;
export type CharterDoubleZeroScore = 0 | 25 | 50;
/** 7–8 captain hand size (10 = Warp 12 default; 11 = Galt/University Games). */
export type CharterLargeFleetHandSize = 10 | 11;

export interface CharterHouseRulesConfig {
  requireOwnTrailFirst: boolean;
  neutralZoneAfterAllTrails: boolean;
  beaconClearsOnAnyPlay: boolean;
  roundStarterPlaysTwo: boolean;
  dropToImpulseCall: boolean;
  dropToImpulseCatchPenalty: CharterDropToImpulseCatchPenalty;
  allStopCeremony: boolean;
  passRedAlertWithoutDraw: boolean;
  manualShieldControl: boolean;
  doubleZeroScore: CharterDoubleZeroScore;
  largeFleetHandSize: CharterLargeFleetHandSize;
}

/** Official Warp 12 bundle — matches apps/Warp12 warp12-preset defaults. */
export const OFFICIAL_CHARTER_MODULES: CharterModulesConfig = {
  salamanderPenalty: true,
  continuum: true,
  subspaceFracture: false,
  subspaceFractureScope: 'own-trail',
  sensorGrid: false,
  sensorGridSize: 5,
  warpDriveSpool: false,
  temporalDebt: false,
  temporalDebtCostPerToken: 2,
  longestTrail: false,
  longestTrailBonus: -3,
  doubleDown: false,
  doubleDownDrawCount: 2,
  squadrons: false,
  squadronSize: 2,
  drafting: false,
  temporalInversion: false,
  wormholes: false,
};

export const OFFICIAL_CHARTER_HOUSE_RULES: CharterHouseRulesConfig = {
  dropToImpulseCall: true,
  dropToImpulseCatchPenalty: 1,
  allStopCeremony: true,
  requireOwnTrailFirst: false,
  neutralZoneAfterAllTrails: false,
  beaconClearsOnAnyPlay: false,
  roundStarterPlaysTwo: false,
  passRedAlertWithoutDraw: false,
  manualShieldControl: false,
  doubleZeroScore: 0,
  largeFleetHandSize: 10,
};

export type CharterModulesInput = Partial<CharterModulesConfig>;
export type CharterHouseRulesInput = Partial<CharterHouseRulesConfig>;

function resolveScope(
  value: CharterSubspaceFractureScope | undefined
): CharterSubspaceFractureScope {
  if (
    value === 'all-captains' ||
    value === 'all-doubles' ||
    value === 'own-trail'
  ) {
    return value;
  }
  return OFFICIAL_CHARTER_MODULES.subspaceFractureScope;
}

export function resolveCharterModules(
  input: CharterModulesInput = {}
): CharterModulesConfig {
  return {
    salamanderPenalty:
      input.salamanderPenalty ?? OFFICIAL_CHARTER_MODULES.salamanderPenalty,
    continuum: input.continuum ?? OFFICIAL_CHARTER_MODULES.continuum,
    subspaceFracture:
      input.subspaceFracture ?? OFFICIAL_CHARTER_MODULES.subspaceFracture,
    subspaceFractureScope: resolveScope(input.subspaceFractureScope),
    sensorGrid: input.sensorGrid ?? OFFICIAL_CHARTER_MODULES.sensorGrid,
    sensorGridSize: input.sensorGridSize ?? OFFICIAL_CHARTER_MODULES.sensorGridSize,
    warpDriveSpool: input.warpDriveSpool ?? OFFICIAL_CHARTER_MODULES.warpDriveSpool,
    temporalDebt: input.temporalDebt ?? OFFICIAL_CHARTER_MODULES.temporalDebt,
    temporalDebtCostPerToken: input.temporalDebtCostPerToken ?? OFFICIAL_CHARTER_MODULES.temporalDebtCostPerToken,
    longestTrail: input.longestTrail ?? OFFICIAL_CHARTER_MODULES.longestTrail,
    longestTrailBonus: input.longestTrailBonus ?? OFFICIAL_CHARTER_MODULES.longestTrailBonus,
    doubleDown: input.doubleDown ?? OFFICIAL_CHARTER_MODULES.doubleDown,
    doubleDownDrawCount: input.doubleDownDrawCount ?? OFFICIAL_CHARTER_MODULES.doubleDownDrawCount,
    squadrons: input.squadrons ?? OFFICIAL_CHARTER_MODULES.squadrons,
    squadronSize:
      input.squadronSize === 3 ? 3 : OFFICIAL_CHARTER_MODULES.squadronSize,
    drafting: input.drafting ?? OFFICIAL_CHARTER_MODULES.drafting,
    temporalInversion: input.temporalInversion ?? OFFICIAL_CHARTER_MODULES.temporalInversion,
    wormholes: input.wormholes ?? OFFICIAL_CHARTER_MODULES.wormholes,
  };
}

export function resolveCharterHouseRules(
  input: CharterHouseRulesInput = {}
): CharterHouseRulesConfig {
  return {
    requireOwnTrailFirst:
      input.requireOwnTrailFirst ??
      OFFICIAL_CHARTER_HOUSE_RULES.requireOwnTrailFirst,
    neutralZoneAfterAllTrails:
      input.neutralZoneAfterAllTrails ??
      OFFICIAL_CHARTER_HOUSE_RULES.neutralZoneAfterAllTrails,
    beaconClearsOnAnyPlay:
      input.beaconClearsOnAnyPlay ??
      OFFICIAL_CHARTER_HOUSE_RULES.beaconClearsOnAnyPlay,
    roundStarterPlaysTwo:
      input.roundStarterPlaysTwo ??
      OFFICIAL_CHARTER_HOUSE_RULES.roundStarterPlaysTwo,
    dropToImpulseCall:
      input.dropToImpulseCall ?? OFFICIAL_CHARTER_HOUSE_RULES.dropToImpulseCall,
    dropToImpulseCatchPenalty:
      input.dropToImpulseCatchPenalty === 2
        ? 2
        : OFFICIAL_CHARTER_HOUSE_RULES.dropToImpulseCatchPenalty,
    allStopCeremony:
      input.allStopCeremony ?? OFFICIAL_CHARTER_HOUSE_RULES.allStopCeremony,
    passRedAlertWithoutDraw:
      input.passRedAlertWithoutDraw ??
      OFFICIAL_CHARTER_HOUSE_RULES.passRedAlertWithoutDraw,
    manualShieldControl:
      input.manualShieldControl ??
      OFFICIAL_CHARTER_HOUSE_RULES.manualShieldControl,
    doubleZeroScore:
      input.doubleZeroScore === 0 ||
      input.doubleZeroScore === 25 ||
      input.doubleZeroScore === 50
        ? input.doubleZeroScore
        : OFFICIAL_CHARTER_HOUSE_RULES.doubleZeroScore,
    largeFleetHandSize:
      input.largeFleetHandSize === 11
        ? 11
        : OFFICIAL_CHARTER_HOUSE_RULES.largeFleetHandSize,
  };
}

export function effectiveCharterModules(
  charter: { modules?: CharterModulesInput }
): CharterModulesConfig {
  return resolveCharterModules(charter.modules);
}

export function effectiveCharterHouseRules(
  charter: { houseRules?: CharterHouseRulesInput }
): CharterHouseRulesConfig {
  return resolveCharterHouseRules(charter.houseRules);
}

export function charterModulesMatch(
  charter: { modules?: CharterModulesInput },
  gameModules: CharterModulesInput
): boolean {
  const expected = effectiveCharterModules(charter);
  const actual = resolveCharterModules(gameModules);
  return (
    expected.salamanderPenalty === actual.salamanderPenalty &&
    expected.continuum === actual.continuum &&
    expected.subspaceFracture === actual.subspaceFracture &&
    expected.subspaceFractureScope === actual.subspaceFractureScope &&
    expected.sensorGrid === actual.sensorGrid &&
    (expected.sensorGridSize ?? 5) === (actual.sensorGridSize ?? 5) &&
    expected.warpDriveSpool === actual.warpDriveSpool &&
    expected.temporalDebt === actual.temporalDebt &&
    (expected.temporalDebtCostPerToken ?? 2) === (actual.temporalDebtCostPerToken ?? 2) &&
    expected.longestTrail === actual.longestTrail &&
    (expected.longestTrailBonus ?? -3) === (actual.longestTrailBonus ?? -3) &&
    expected.doubleDown === actual.doubleDown &&
    (expected.doubleDownDrawCount ?? 2) === (actual.doubleDownDrawCount ?? 2) &&
    expected.squadrons === actual.squadrons &&
    (expected.squadronSize ?? 2) === (actual.squadronSize ?? 2) &&
    expected.drafting === actual.drafting &&
    expected.temporalInversion === actual.temporalInversion &&
    expected.wormholes === actual.wormholes
  );
}

export function charterHouseRulesMatch(
  charter: { houseRules?: CharterHouseRulesInput },
  gameHouseRules: CharterHouseRulesInput = {}
): boolean {
  const expected = effectiveCharterHouseRules(charter);
  const actual = resolveCharterHouseRules(gameHouseRules);
  return (
    expected.requireOwnTrailFirst === actual.requireOwnTrailFirst &&
    expected.neutralZoneAfterAllTrails === actual.neutralZoneAfterAllTrails &&
    expected.beaconClearsOnAnyPlay === actual.beaconClearsOnAnyPlay &&
    expected.roundStarterPlaysTwo === actual.roundStarterPlaysTwo &&
    expected.dropToImpulseCall === actual.dropToImpulseCall &&
    expected.dropToImpulseCatchPenalty === actual.dropToImpulseCatchPenalty &&
    expected.allStopCeremony === actual.allStopCeremony &&
    expected.passRedAlertWithoutDraw === actual.passRedAlertWithoutDraw &&
    expected.manualShieldControl === actual.manualShieldControl &&
    expected.doubleZeroScore === actual.doubleZeroScore &&
    expected.largeFleetHandSize === actual.largeFleetHandSize
  );
}
