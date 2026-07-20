import { pronounsForCaptain, type PronounForms } from './pronouns.js';

/** Stable 0..count-1 pick from an entry seed (same line always, variety across lines). */
export function phraseVariantIndex(seed: string, count: number): number {
  if (count <= 1) {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % count;
}

export type ShieldControlAction = 'deploy' | 'raise';
export type ShieldControlTense = 'present' | 'past';

/**
 * Manual shield control (and voluntary beacon) copy — alternate Distress Beacon
 * vs shields wording for variety.
 */
export function shieldControlPhrase(
  action: ShieldControlAction,
  tense: ShieldControlTense,
  possessive: string,
  variantIndex: number
): string {
  if (action === 'deploy') {
    const variants =
      tense === 'present'
        ? [
            `puts up ${possessive} Distress Beacon`,
            `lowers ${possessive} shields`,
          ]
        : [
            `put up ${possessive} Distress Beacon`,
            `lowered ${possessive} shields`,
          ];
    return variants[variantIndex % variants.length]!;
  }

  const variants =
    tense === 'present'
      ? [
          `raises ${possessive} shields`,
          `takes down ${possessive} Distress Beacon`,
        ]
      : [
          `raised ${possessive} shields`,
          `took down ${possessive} Distress Beacon`,
        ];
  return variants[variantIndex % variants.length]!;
}

export function shieldControlPhraseForCaptain(
  action: ShieldControlAction,
  tense: ShieldControlTense,
  captainId: string,
  at: string,
  pronouns?: Readonly<Record<string, PronounForms>>
): string {
  const forms = pronounsForCaptain(captainId, pronouns);
  const variant = phraseVariantIndex(`${at}|${captainId}|${action}`, 2);
  return shieldControlPhrase(action, tense, forms.possessive, variant);
}
