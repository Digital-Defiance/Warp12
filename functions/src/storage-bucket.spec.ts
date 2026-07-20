import { describe, expect, it } from 'vitest';

import { isMissingStorageBucketError } from './storage-bucket.js';

describe('storage-bucket', () => {
  it('detects missing-bucket errors', () => {
    expect(
      isMissingStorageBucketError(
        new Error('The specified bucket does not exist.')
      )
    ).toBe(true);
    expect(isMissingStorageBucketError(new Error('permission denied'))).toBe(
      false
    );
  });
});
