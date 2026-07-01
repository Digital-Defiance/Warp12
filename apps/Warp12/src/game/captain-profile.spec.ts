import { describe, expect, it, beforeEach } from 'vitest';

import '../test/setup.js';
import {
  captainGenderLabel,
  captainPilotIcon,
  CAPTAIN_GENDER_OPTIONS,
  DEFAULT_CAPTAIN_GENDER,
  readCaptainGenderLocal,
  writeCaptainGenderLocal,
} from './captain-profile.js';

describe('captain-profile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('maps each gender to the correct pilot icon', () => {
    expect(captainPilotIcon('other')).toBe('/user-pilot-duotone-solid-full.svg');
    expect(captainPilotIcon('male')).toBe(
      '/user-pilot-tie-duotone-solid-full.svg'
    );
    expect(captainPilotIcon('female')).toBe(
      '/user-pilot-tie-hair-long-duotone-solid-full.svg'
    );
  });

  it('persists gender locally', () => {
    writeCaptainGenderLocal('female');
    expect(readCaptainGenderLocal()).toBe('female');
  });

  it('defaults to x when unset', () => {
    expect(DEFAULT_CAPTAIN_GENDER).toBe('other');
    expect(readCaptainGenderLocal()).toBe('other');
  });

  it('lists all avatar options', () => {
    expect(CAPTAIN_GENDER_OPTIONS).toEqual(['other', 'male', 'female']);
    expect(captainGenderLabel('other')).toBe('Captain X');
  });
});
