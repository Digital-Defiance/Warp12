/** Trim and compare call signs case-insensitively. */
export function normalizeCallSign(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function isCallSignTaken(
  captains: readonly { displayName: string }[],
  name: string
): boolean {
  const key = normalizeCallSign(name);
  if (!key) {
    return true;
  }
  return captains.some(
    (captain) => normalizeCallSign(captain.displayName) === key
  );
}

/**
 * Returns a lobby-unique call sign. Keeps the requested name when free; otherwise
 * assigns "Name (2)", "Name (3)", …
 */
export function allocateUniqueCallSign(
  captains: readonly { displayName: string }[],
  requested: string
): string {
  const base = requested.trim();
  if (!base) {
    return base;
  }
  if (!isCallSignTaken(captains, base)) {
    return base;
  }

  for (let suffix = 2; suffix <= captains.length + 2; suffix++) {
    const candidate = `${base} (${suffix})`;
    if (!isCallSignTaken(captains, candidate)) {
      return candidate;
    }
  }

  return `${base} (${captains.length + 2})`;
}
