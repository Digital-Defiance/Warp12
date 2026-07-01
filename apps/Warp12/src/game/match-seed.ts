/** Cryptographic match seed for deals and AI streams (replay-safe). */
export function drawMatchSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}
