import { describe, expect, it } from 'vitest';

import {
  tickFromDegreesCw,
  warpFactorFromTick,
  warpFactorFromViewBoxPoint,
} from './factor-gauge';

describe('warpFactorFromTick', () => {
  it('maps the top half (14–17, 0–4) to Warp 9', () => {
    for (const t of [14, 15, 16, 17, 0, 1, 2, 3, 4]) {
      expect(warpFactorFromTick(t)).toBe(9);
    }
  });

  it('maps the next 3 down the left (11–13) to Warp 12', () => {
    expect(warpFactorFromTick(11)).toBe(12);
    expect(warpFactorFromTick(12)).toBe(12);
    expect(warpFactorFromTick(13)).toBe(12);
  });

  it('maps the bottom arc (8–10) to Warp 15', () => {
    expect(warpFactorFromTick(8)).toBe(15);
    expect(warpFactorFromTick(9)).toBe(15);
    expect(warpFactorFromTick(10)).toBe(15);
  });

  it('maps the last 3 lower-right (5–7) to Warp 18', () => {
    expect(warpFactorFromTick(5)).toBe(18);
    expect(warpFactorFromTick(6)).toBe(18);
    expect(warpFactorFromTick(7)).toBe(18);
  });
});

describe('tickFromDegreesCw', () => {
  it('places tick 0 at 12 o’clock and steps by 20°', () => {
    expect(tickFromDegreesCw(0)).toBe(0);
    expect(tickFromDegreesCw(20)).toBe(1);
    expect(tickFromDegreesCw(180)).toBe(9);
    expect(tickFromDegreesCw(340)).toBe(17);
  });

  it('rounds to the nearest dash', () => {
    expect(tickFromDegreesCw(9)).toBe(0);
    expect(tickFromDegreesCw(11)).toBe(1);
  });
});

describe('warpFactorFromViewBoxPoint', () => {
  const cx = 261.12;
  const cy = 256;

  it('returns null outside the face', () => {
    expect(warpFactorFromViewBoxPoint(0, 0)).toBeNull();
    expect(warpFactorFromViewBoxPoint(512, 512)).toBeNull();
  });

  it('resolves exclusive illumination bands on the shared circumference', () => {
    const at = (degreesCw: number, radius = 150) => {
      const rad = (degreesCw * Math.PI) / 180;
      return warpFactorFromViewBoxPoint(
        cx + radius * Math.sin(rad),
        cy - radius * Math.cos(rad)
      );
    };

    expect(at(0)).toBe(9); // tick 0 — top half
    expect(at(180)).toBe(15); // tick 9 — bottom
    expect(at(220)).toBe(12); // tick 11 — left side
    expect(at(120)).toBe(18); // tick 6 — lower right
    expect(at(340)).toBe(9); // tick 17 — top half left
  });
});
