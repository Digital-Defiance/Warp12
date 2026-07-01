/** Distress Beacon — other captains may chart on this warp trail while active. */
export interface DistressBeacon {
  readonly active: boolean;
}

export interface Captain {
  readonly id: string;
  readonly displayName: string;
  /** Cumulative points score across completed rounds. */
  readonly pointsScore: number;
}

export type PlayerId = Captain['id'];
