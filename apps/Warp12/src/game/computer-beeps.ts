/** IDs with a matching file under `public/beeps/` (gaps: 17, 76). */
export const COMPUTER_BEEP_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
  42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 77,
] as const;

export type ComputerBeepId = (typeof COMPUTER_BEEP_IDS)[number];

const BEEP_ID_SET = new Set<number>(COMPUTER_BEEP_IDS);

export function isComputerBeepId(value: unknown): value is ComputerBeepId {
  return typeof value === 'number' && BEEP_ID_SET.has(value);
}

export function computerBeepUrl(id: ComputerBeepId): string {
  return `/beeps/computerbeep_${id}.mp3`;
}

export function computerBeepLabel(id: ComputerBeepId): string {
  return `Beep ${id}`;
}

/** Pick a random beep from files that exist in `public/beeps/`. */
export function pickRandomComputerBeepId(
  rng: () => number = Math.random
): ComputerBeepId {
  const index = Math.floor(rng() * COMPUTER_BEEP_IDS.length);
  return COMPUTER_BEEP_IDS[Math.min(index, COMPUTER_BEEP_IDS.length - 1)]!;
}
