/** Frozen lobby settings stored on a crew charter (Firestore game-doc shape). */

export type CharterSubspaceFractureScope =
  | 'own-trail'
  | 'all-captains'
  | 'all-doubles';

export interface CharterModulesConfig {
  salamanderPenalty: boolean;
  qContinuum: boolean;
  subspaceFracture: boolean;
  subspaceFractureScope: CharterSubspaceFractureScope;
}

export type CharterDropToImpulseCatchPenalty = 1 | 2;
export type CharterDoubleZeroScore = 0 | 25 | 50;

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
}

/** Official Warp 12 bundle — matches apps/Warp12 warp12-preset defaults. */
export const OFFICIAL_CHARTER_MODULES: CharterModulesConfig = {
  salamanderPenalty: true,
  qContinuum: true,
  subspaceFracture: false,
  subspaceFractureScope: 'own-trail',
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
    qContinuum: input.qContinuum ?? OFFICIAL_CHARTER_MODULES.qContinuum,
    subspaceFracture:
      input.subspaceFracture ?? OFFICIAL_CHARTER_MODULES.subspaceFracture,
    subspaceFractureScope: resolveScope(input.subspaceFractureScope),
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
    expected.qContinuum === actual.qContinuum &&
    expected.subspaceFracture === actual.subspaceFracture &&
    expected.subspaceFractureScope === actual.subspaceFractureScope
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
    expected.doubleZeroScore === actual.doubleZeroScore
  );
}
