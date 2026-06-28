/** Distress Beacon — other captains may chart on this warp trail while active. */
export interface DistressBeacon {
  readonly active: boolean;
}

export interface Captain {
  readonly id: string;
  readonly displayName: string;
  /** Cumulative penalty score across completed rounds. */
  readonly penaltyScore: number;
}

export type PlayerId = Captain['id'];
