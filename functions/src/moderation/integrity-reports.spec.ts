import { describe, expect, it } from 'vitest';

import { integrityReportId } from './integrity-reports';
import { REPORT_ESCALATE_THRESHOLD } from './escalate';

describe('integrity reports', () => {
  it('builds stable report ids for the same detector key', () => {
    const a = integrityReportId('rematch-cohort', 'u1|u2', 'human', 'points');
    const b = integrityReportId('rematch-cohort', 'u1|u2', 'human', 'points');
    const c = integrityReportId('rematch-cohort', 'u1|u3', 'human', 'points');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('system-rematch-cohort-')).toBe(true);
  });

  it('keeps escalate threshold review-only (human queue, no auto-ban)', () => {
    expect(REPORT_ESCALATE_THRESHOLD).toBeGreaterThanOrEqual(2);
  });
});
