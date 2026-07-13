import { describe, expect, it } from 'vitest';

import {
  compareTeiDisplay,
  getTeiRank,
  getTeiRankFromFormatted,
  isFlagOfficerRank,
  parseTeiFormatted,
} from './tei-rank.js';

describe('compareTeiDisplay', () => {
  it('orders by letter before score', () => {
    expect(
      compareTeiDisplay({ grade: 'I', score: 9 }, { grade: 'P', score: 90 })
    ).toBeGreaterThan(0);
    expect(
      compareTeiDisplay({ grade: 'C', score: 21 }, { grade: 'I', score: 40 })
    ).toBeGreaterThan(0);
  });

  it('orders by score within the same letter', () => {
    expect(
      compareTeiDisplay({ grade: 'V', score: 70 }, { grade: 'V', score: 63 })
    ).toBeGreaterThan(0);
  });
});

describe('getTeiRank', () => {
  it('maps Cadet below P25', () => {
    expect(getTeiRank({ grade: 'P', score: 0 }).id).toBe('cadet');
    expect(getTeiRank({ grade: 'P', score: 24 }).id).toBe('cadet');
  });

  it('maps Ensign from P25 through early Improving', () => {
    expect(getTeiRank({ grade: 'P', score: 25 }).id).toBe('ensign');
    expect(getTeiRank({ grade: 'I', score: 2 }).id).toBe('ensign');
    expect(getTeiRank({ grade: 'I', score: 24 }).id).toBe('ensign');
  });

  it('maps Lieutenant Junior Grade from I25', () => {
    const rank = getTeiRank({ grade: 'I', score: 25 });
    expect(rank.id).toBe('lieutenant-jg');
    expect(rank.name).toBe('Lieutenant Junior Grade');
    expect(rank.short).toBe('Lt. JG');
  });

  it('maps Lieutenant from I40 through mid Consistent', () => {
    expect(getTeiRank({ grade: 'I', score: 40 }).id).toBe('lieutenant');
    expect(getTeiRank({ grade: 'C', score: 30 }).id).toBe('lieutenant');
    expect(getTeiRank({ grade: 'C', score: 44 }).id).toBe('lieutenant');
  });

  it('maps Commander neighborhood through Commander / Commodore', () => {
    expect(getTeiRank({ grade: 'C', score: 45 }).id).toBe(
      'lieutenant-commander'
    );
    expect(getTeiRank({ grade: 'C', score: 55 }).id).toBe('commander');
    expect(getTeiRank({ grade: 'V', score: 53 }).id).toBe('commander');
    expect(getTeiRank({ grade: 'V', score: 63 }).id).toBe('commodore');
    expect(getTeiRank({ grade: 'V', score: 62 }).id).toBe('commander');
  });

  it('maps admiralty and Fleet Admiral ceiling', () => {
    expect(getTeiRank({ grade: 'V', score: 70 }).id).toBe('rear-admiral');
    expect(getTeiRank({ grade: 'V', score: 80 }).id).toBe('vice-admiral');
    expect(getTeiRank({ grade: 'V', score: 90 }).id).toBe('admiral');
    expect(getTeiRank({ grade: 'V', score: 99 }).id).toBe('fleet-admiral');
  });

  it('bands Elite letter like Veteran at the same score', () => {
    expect(getTeiRank({ grade: 'E', score: 73 }).id).toBe('rear-admiral');
    expect(getTeiRank({ grade: 'E', score: 99 }).id).toBe('fleet-admiral');
  });
});

describe('isFlagOfficerRank', () => {
  it('is true from Rear Admiral up', () => {
    expect(isFlagOfficerRank('rear-admiral')).toBe(true);
    expect(isFlagOfficerRank(getTeiRank({ grade: 'V', score: 99 }))).toBe(
      true
    );
    expect(isFlagOfficerRank('commander')).toBe(false);
  });
});

describe('parseTeiFormatted', () => {
  it('parses grade strings', () => {
    expect(parseTeiFormatted('V67')).toEqual({ grade: 'V', score: 67 });
    expect(parseTeiFormatted('p00')).toEqual({ grade: 'P', score: 0 });
  });

  it('rejects junk', () => {
    expect(parseTeiFormatted('VX')).toBeNull();
    expect(parseTeiFormatted('')).toBeNull();
  });

  it('getTeiRankFromFormatted works', () => {
    expect(getTeiRankFromFormatted('P25')?.id).toBe('ensign');
    expect(getTeiRankFromFormatted('I25')?.name).toBe(
      'Lieutenant Junior Grade'
    );
  });
});
