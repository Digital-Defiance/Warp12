export type ContentReviewConfig = {
  chatTerms: string[];
  displayNameTerms: string[];
  allowlist: string[];
  updatedAt?: string;
  updatedBy?: string;
};

export type ReviewMatch = {
  term: string;
  normalizedTerm: string;
};

export const EMPTY_CONTENT_REVIEW_CONFIG: ContentReviewConfig = {
  chatTerms: [],
  displayNameTerms: [],
  allowlist: [],
};

/** Unicode-aware tokenization prevents embedded matches such as ass/Cassandra. */
export function contentTokens(value: string): string[] {
  return (
    value
      .normalize('NFKC')
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function containsSequence(tokens: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > tokens.length) {
    return false;
  }
  for (let i = 0; i <= tokens.length - needle.length; i += 1) {
    if (needle.every((token, j) => tokens[i + j] === token)) {
      return true;
    }
  }
  return false;
}

export function normalizeReviewTerm(value: string): string {
  return contentTokens(value).join(' ');
}

export function findReviewMatches(
  value: string,
  terms: readonly string[],
  allowlist: readonly string[]
): ReviewMatch[] {
  const tokens = contentTokens(value);
  if (tokens.length === 0) {
    return [];
  }

  const allowed = new Set(
    allowlist.map(normalizeReviewTerm).filter(Boolean)
  );
  const seen = new Set<string>();
  const matches: ReviewMatch[] = [];

  for (const term of terms) {
    const normalizedTerm = normalizeReviewTerm(term);
    if (!normalizedTerm || allowed.has(normalizedTerm) || seen.has(normalizedTerm)) {
      continue;
    }
    if (containsSequence(tokens, normalizedTerm.split(' '))) {
      seen.add(normalizedTerm);
      matches.push({ term, normalizedTerm });
    }
  }
  return matches;
}

export function sanitizeContentReviewConfig(
  raw: Pick<ContentReviewConfig, 'chatTerms' | 'displayNameTerms' | 'allowlist'>
): ContentReviewConfig {
  const clean = (values: readonly string[]) =>
    [...new Set(values.map(normalizeReviewTerm).filter(Boolean))]
      .slice(0, 250)
      .map((value) => value.slice(0, 80));

  return {
    chatTerms: clean(raw.chatTerms),
    displayNameTerms: clean(raw.displayNameTerms),
    allowlist: clean(raw.allowlist),
  };
}
