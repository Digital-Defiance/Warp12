/** Canonical public Bridge origin for shareable invite links. */
export const PUBLIC_BRIDGE_ORIGIN = 'https://warp.iwdf.org';

function normalizeSectorCode(gameId: string): string {
  return gameId.trim().toUpperCase();
}

function bridgeOriginForShares(): string {
  if (typeof window === 'undefined') {
    return PUBLIC_BRIDGE_ORIGIN;
  }
  const { hostname, origin } = window.location;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost');
  // Dev / preview: share the current origin so links open the running build.
  // Production / Tauri: always hand out the public web Bridge URL.
  if (isLocal || import.meta.env.DEV) {
    return origin;
  }
  return PUBLIC_BRIDGE_ORIGIN;
}

/** Join / take a seat — opens lobby for the sector. */
export function sectorJoinUrl(
  gameId: string,
  origin: string = bridgeOriginForShares()
): string {
  const code = normalizeSectorCode(gameId);
  return `${origin.replace(/\/$/, '')}/online/${encodeURIComponent(code)}`;
}

/** Watch without a seat — public spectate gallery. */
export function sectorWatchUrl(
  gameId: string,
  origin: string = bridgeOriginForShares()
): string {
  return `${sectorJoinUrl(gameId, origin)}/watch`;
}

/** OBS / transparent commentary overlay for an online sector. */
export function sectorCommentaryUrl(
  gameId: string,
  origin: string = bridgeOriginForShares()
): string {
  return `${sectorJoinUrl(gameId, origin)}/commentary`;
}

/**
 * Private hand / second-monitor play surface. Requires Firebase auth whose uid
 * matches a seated captain (anonymous or Google — same session as /play).
 */
export function sectorHandUrl(
  gameId: string,
  origin: string = bridgeOriginForShares()
): string {
  return `${sectorJoinUrl(gameId, origin)}/hand`;
}

export type SectorInviteLinks = {
  code: string;
  joinUrl: string;
  watchUrl: string;
  commentaryUrl: string;
  handUrl: string;
};

export function sectorInviteLinks(gameId: string): SectorInviteLinks {
  const code = normalizeSectorCode(gameId);
  return {
    code,
    joinUrl: sectorJoinUrl(code),
    watchUrl: sectorWatchUrl(code),
    commentaryUrl: sectorCommentaryUrl(code),
    handUrl: sectorHandUrl(code),
  };
}
