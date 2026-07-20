import {
  HE_PRONOUNS,
  SHE_PRONOUNS,
  THEY_PRONOUNS,
  parseCustomPronounSlash,
  presetPronounForms,
  type PronounForms,
  type PronounPresetId,
} from 'warp12-react';

/** Stored preference — independent of captain avatar gender. */
export interface CaptainPronounPreference {
  readonly preset: PronounPresetId;
  /** Slash form subject/object/possessive[/independent] when preset is custom. */
  readonly custom?: string;
}

export const DEFAULT_CAPTAIN_PRONOUNS: CaptainPronounPreference = {
  preset: 'they',
};

const STORAGE_KEY = 'warp12-captain-pronouns';

export const CAPTAIN_PRONOUN_PRESETS: readonly {
  readonly id: PronounPresetId;
  readonly label: string;
  readonly example: string;
}[] = [
  { id: 'she', label: 'She / her', example: 'she / her / hers' },
  { id: 'he', label: 'He / him', example: 'he / him / his' },
  { id: 'they', label: 'They / them', example: 'they / them / their' },
  { id: 'custom', label: 'Custom', example: 'xe / xem / xyr' },
];

export function isPronounPresetId(value: unknown): value is PronounPresetId {
  return (
    value === 'they' || value === 'she' || value === 'he' || value === 'custom'
  );
}

export function isCaptainPronounPreference(
  value: unknown
): value is CaptainPronounPreference {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const raw = value as { preset?: unknown; custom?: unknown };
  if (!isPronounPresetId(raw.preset)) {
    return false;
  }
  if (raw.custom !== undefined && typeof raw.custom !== 'string') {
    return false;
  }
  return true;
}

export function readCaptainPronounsLocal(): CaptainPronounPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CAPTAIN_PRONOUNS;
    }
    const parsed: unknown = JSON.parse(raw);
    return isCaptainPronounPreference(parsed)
      ? sanitizePronounPreference(parsed)
      : DEFAULT_CAPTAIN_PRONOUNS;
  } catch {
    return DEFAULT_CAPTAIN_PRONOUNS;
  }
}

export function writeCaptainPronounsLocal(
  preference: CaptainPronounPreference
): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sanitizePronounPreference(preference))
    );
  } catch {
    // ignore quota / private mode
  }
}

export function resolveCaptainPronouns(
  cloud: CaptainPronounPreference | undefined
): CaptainPronounPreference {
  if (isCaptainPronounPreference(cloud)) {
    return sanitizePronounPreference(cloud);
  }
  return readCaptainPronounsLocal();
}

export function sanitizePronounPreference(
  preference: CaptainPronounPreference
): CaptainPronounPreference {
  if (preference.preset !== 'custom') {
    return { preset: preference.preset };
  }
  const custom = preference.custom?.trim() ?? '';
  return { preset: 'custom', custom };
}

/** Resolve preference → forms used by commentator / game log. */
export function pronounFormsFromPreference(
  preference: CaptainPronounPreference
): PronounForms {
  if (preference.preset === 'custom') {
    return (
      parseCustomPronounSlash(preference.custom ?? '') ?? THEY_PRONOUNS
    );
  }
  return presetPronounForms(preference.preset);
}

export function captainPronounsLabel(
  preference: CaptainPronounPreference
): string {
  switch (preference.preset) {
    case 'she':
      return 'she / her / hers';
    case 'he':
      return 'he / him / his';
    case 'custom': {
      const forms = pronounFormsFromPreference(preference);
      if (forms === THEY_PRONOUNS && !preference.custom?.trim()) {
        return 'Custom (enter forms)';
      }
      return `${forms.subject} / ${forms.object} / ${forms.possessive}`;
    }
    default:
      return 'they / them / their';
  }
}

export {
  HE_PRONOUNS,
  SHE_PRONOUNS,
  THEY_PRONOUNS,
  type PronounForms,
  type PronounPresetId,
};
