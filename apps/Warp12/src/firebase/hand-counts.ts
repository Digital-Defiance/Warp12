/** Preserve opponents' public hand counts while syncing the actor's move. */
export function patchHandCounts(
  previous: Record<string, number> | undefined,
  _turnOrder: readonly string[],
  actorId: string,
  actorHandSize: number
): Record<string, number> {
  return {
    ...(previous ?? {}),
    [actorId]: actorHandSize,
  };
}
