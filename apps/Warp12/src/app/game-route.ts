/** Routes where leaving the page would drop lobby or in-progress game state. */
export function preservesGameSession(pathname: string): boolean {
  return pathname.startsWith('/local') || pathname.startsWith('/online');
}
