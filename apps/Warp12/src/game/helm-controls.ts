import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsManually,
  type HouseRules,
  type RoundState,
} from 'warp12-engine';

export interface HelmControls {
  showDraw: boolean;
  showShieldsDown: boolean;
  showShieldsUp: boolean;
  showPassRedAlert: boolean;
  showPass: boolean;
}

/** Which helm control buttons should appear for the active captain. */
export function resolveHelmControls(input: {
  round: RoundState | null | undefined;
  handOwnerId: string;
  isMyTurn: boolean;
  houseRules: HouseRules;
  dropToImpulsePending: boolean;
  legalMovesCount: number;
}): HelmControls {
  const {
    round,
    handOwnerId,
    isMyTurn,
    houseRules,
    dropToImpulsePending,
    legalMovesCount,
  } = input;

  if (!round || !isMyTurn) {
    return {
      showDraw: false,
      showShieldsDown: false,
      showShieldsUp: false,
      showPassRedAlert: false,
      showPass: false,
    };
  }

  return {
    showDraw: canDrawFromUncharted(round, handOwnerId, houseRules),
    showShieldsDown: canDeployDistressBeacon(round, handOwnerId, { houseRules }),
    showShieldsUp: canRaiseShieldsManually(round, handOwnerId, houseRules),
    showPassRedAlert: canPassRedAlert(round, handOwnerId, { houseRules }),
    showPass: canPassTurn(round, handOwnerId, { houseRules }),
  };
}
