/** Distress Beacon — other captains may chart on this warp trail while active. */
export interface DistressBeacon {
  readonly active: boolean;
  /**
   * Manual shield control only: true once the trail owner has charted on their
   * own trail since this beacon was deployed (shields dropped). Gates the
   * manual "Shields up" — you must service your own trail again before you may
   * raise shields. Reset to false each time the beacon is deployed.
   */
  readonly chartedOwnTrailSinceDown?: boolean;
  /**
   * Module Eta (Go-out) Desperation Dig: beacon stays forced open for this many
   * remaining turn-ends by the trail holder. While &gt; 0, auto-raise / manual
   * raise cannot clear the beacon.
   */
  readonly forcedOpenRemaining?: number;
}

export interface Captain {
  readonly id: string;
  readonly displayName: string;
  /** Cumulative points score across completed rounds. */
  readonly pointsScore: number;
  /**
   * Go-out campaigns: rounds won by emptying the hand (ignored for
   * sudden-death except as 0/1 at sector end).
   */
  readonly goOutWins?: number;
  /** Module Zeta: squadron this captain belongs to, when squadrons are enabled. */
  readonly squadronId?: string;
}

export type PlayerId = Captain['id'];
