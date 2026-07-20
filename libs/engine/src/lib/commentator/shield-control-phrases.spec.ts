import { describe, expect, it } from 'vitest';

import { HE_PRONOUNS, SHE_PRONOUNS } from './pronouns.js';
import {
  phraseVariantIndex,
  shieldControlPhrase,
  shieldControlPhraseForCaptain,
} from './shield-control-phrases.js';

describe('shieldControlPhrase', () => {
  it('alternates Distress Beacon and shields wording', () => {
    expect(shieldControlPhrase('deploy', 'present', 'their', 0)).toBe(
      'puts up their Distress Beacon'
    );
    expect(shieldControlPhrase('deploy', 'present', 'their', 1)).toBe(
      'lowers their shields'
    );
    expect(shieldControlPhrase('raise', 'present', 'his', 0)).toBe(
      'raises his shields'
    );
    expect(shieldControlPhrase('raise', 'present', 'her', 1)).toBe(
      'takes down her Distress Beacon'
    );
  });

  it('uses past tense for the fleet log', () => {
    expect(shieldControlPhrase('deploy', 'past', 'their', 0)).toBe(
      'put up their Distress Beacon'
    );
    expect(shieldControlPhrase('raise', 'past', 'their', 1)).toBe(
      'took down their Distress Beacon'
    );
  });

  it('picks a stable variant from the entry seed', () => {
    const seed = '2026-06-28T21:07:00.000Z|armstrong|deploy';
    const a = phraseVariantIndex(seed, 2);
    const b = phraseVariantIndex(seed, 2);
    expect(a).toBe(b);
    expect(a === 0 || a === 1).toBe(true);
  });

  it('honors captain pronouns', () => {
    expect(
      shieldControlPhraseForCaptain(
        'deploy',
        'present',
        'blitz',
        '2026-06-28T21:07:00.000Z',
        { blitz: HE_PRONOUNS }
      )
    ).toMatch(/^(puts up his Distress Beacon|lowers his shields)$/);

    expect(
      shieldControlPhraseForCaptain(
        'raise',
        'present',
        'blitz',
        '2026-06-28T21:07:10.000Z',
        { blitz: SHE_PRONOUNS }
      )
    ).toMatch(/^(raises her shields|takes down her Distress Beacon)$/);
  });

  it('covers both deploy variants across different seeds', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      seen.add(
        shieldControlPhraseForCaptain(
          'deploy',
          'present',
          'blitz',
          `2026-06-28T21:07:${String(i).padStart(2, '0')}.000Z`
        )
      );
    }
    expect(seen.has('puts up their Distress Beacon')).toBe(true);
    expect(seen.has('lowers their shields')).toBe(true);
  });
});
