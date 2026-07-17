import { describe, expect, it } from 'vitest';

import {
  contentTokens,
  findReviewMatches,
  sanitizeContentReviewConfig,
} from './content-review.js';

describe('content review matching', () => {
  it('matches whole tokens but not embedded name substrings', () => {
    expect(findReviewMatches('that is ass', ['ass'], [])).toHaveLength(1);
    expect(findReviewMatches('Captain Cassandra', ['ass'], [])).toHaveLength(0);
  });

  it('matches multi-token phrases across punctuation and case', () => {
    expect(
      findReviewMatches('BAD—WORD here', ['bad word'], [])
    ).toEqual([{ term: 'bad word', normalizedTerm: 'bad word' }]);
  });

  it('honors normalized allowlist entries', () => {
    expect(findReviewMatches('red alert', ['RED ALERT'], ['red-alert'])).toEqual(
      []
    );
  });

  it('normalizes unicode-compatible text and deduplicates config', () => {
    expect(contentTokens('Ｆｌｅｅｔ—12')).toEqual(['fleet', '12']);
    expect(
      sanitizeContentReviewConfig({
        chatTerms: [' Bad  Word ', 'bad-word'],
        displayNameTerms: [],
        allowlist: [],
      }).chatTerms
    ).toEqual(['bad word']);
  });
});
