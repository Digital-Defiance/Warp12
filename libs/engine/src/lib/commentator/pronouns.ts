/**
 * Pronoun forms for narrator / commentator copy.
 * Separate from captain avatar gender — e.g. female avatar + they/them is valid.
 */
export interface PronounForms {
  /** they / she / he */
  readonly subject: string;
  /** them / her / him */
  readonly object: string;
  /** their / her / his (as in "their own Trail") */
  readonly possessive: string;
  /** theirs / hers / his */
  readonly possessiveIndependent: string;
  /** true → "they keep"; false → "she keeps" */
  readonly plural: boolean;
}

export const THEY_PRONOUNS: PronounForms = {
  subject: 'they',
  object: 'them',
  possessive: 'their',
  possessiveIndependent: 'theirs',
  plural: true,
};

export const SHE_PRONOUNS: PronounForms = {
  subject: 'she',
  object: 'her',
  possessive: 'her',
  possessiveIndependent: 'hers',
  plural: false,
};

export const HE_PRONOUNS: PronounForms = {
  subject: 'he',
  object: 'him',
  possessive: 'his',
  possessiveIndependent: 'his',
  plural: false,
};

export type PronounPresetId = 'they' | 'she' | 'he' | 'custom';

export function presetPronounForms(preset: Exclude<PronounPresetId, 'custom'>): PronounForms {
  switch (preset) {
    case 'she':
      return SHE_PRONOUNS;
    case 'he':
      return HE_PRONOUNS;
    default:
      return THEY_PRONOUNS;
  }
}

/**
 * Parse "xe/xem/xyr" or "xe/xem/xyr/xyrs". Missing 4th form reuses possessive.
 * Custom sets are treated as singular for verb agreement unless subject is they/them.
 */
export function parseCustomPronounSlash(raw: string): PronounForms | null {
  const parts = raw
    .split(/[/|,]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) {
    return null;
  }
  const [subject, object, possessive, independent] = parts;
  if (!subject || !object || !possessive) {
    return null;
  }
  const plural = subject === 'they';
  return {
    subject,
    object,
    possessive,
    possessiveIndependent: independent ?? possessive,
    plural,
  };
}

/** Prefer explicit forms; otherwise default they/them/their. */
export function resolvePronounForms(
  forms: PronounForms | null | undefined
): PronounForms {
  if (!forms?.subject || !forms.object || !forms.possessive) {
    return THEY_PRONOUNS;
  }
  return {
    subject: forms.subject,
    object: forms.object,
    possessive: forms.possessive,
    possessiveIndependent: forms.possessiveIndependent || forms.possessive,
    plural: forms.plural === true,
  };
}

export function pronounKeepVerb(forms: PronounForms): string {
  return resolvePronounForms(forms).plural ? 'keep' : 'keeps';
}

export function pronounsForCaptain(
  captainId: string,
  map: Readonly<Record<string, PronounForms>> | undefined
): PronounForms {
  return resolvePronounForms(map?.[captainId]);
}
