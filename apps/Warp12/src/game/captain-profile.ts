export type CaptainGender = 'other' | 'male' | 'female';

export const DEFAULT_CAPTAIN_GENDER: CaptainGender = 'other';

export const ALL_CAPTAINS_ADVISOR_ICON =
  '/people-group-sharp-duotone-light-full.svg';

const PILOT_ICON: Record<CaptainGender, string> = {
  other: '/user-pilot-duotone-solid-full.svg',
  male: '/user-pilot-tie-duotone-solid-full.svg',
  female: '/user-pilot-tie-hair-long-duotone-solid-full.svg',
};

const STORAGE_KEY = 'warp12-captain-gender';

export const CAPTAIN_GENDER_OPTIONS: readonly CaptainGender[] = [
  'other',
  'male',
  'female',
];

export function captainPilotIcon(gender: CaptainGender): string {
  return PILOT_ICON[gender];
}

export function isCaptainGender(value: unknown): value is CaptainGender {
  return value === 'other' || value === 'male' || value === 'female';
}

export function readCaptainGenderLocal(): CaptainGender {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isCaptainGender(raw) ? raw : DEFAULT_CAPTAIN_GENDER;
  } catch {
    return DEFAULT_CAPTAIN_GENDER;
  }
}

export function writeCaptainGenderLocal(gender: CaptainGender): void {
  try {
    localStorage.setItem(STORAGE_KEY, gender);
  } catch {
    // ignore quota / private mode
  }
}

/** Prefer cloud profile when signed in; fall back to local device setting. */
export function resolveCaptainGender(
  cloudGender: CaptainGender | undefined
): CaptainGender {
  if (isCaptainGender(cloudGender)) {
    return cloudGender;
  }
  return readCaptainGenderLocal();
}

export function captainGenderLabel(gender: CaptainGender): string {
  switch (gender) {
    case 'other':
      return 'Captain X';
    case 'female':
      return 'Female captain';
    default:
      return 'Male captain';
  }
}
