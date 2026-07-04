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
}

export interface Captain {
  readonly id: string;
  readonly displayName: string;
  /** Cumulative points score across completed rounds. */
  readonly pointsScore: number;
}

export type PlayerId = Captain['id'];
