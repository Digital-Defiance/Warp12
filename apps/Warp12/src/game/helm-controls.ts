import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsManually,
  getSpoolOptions,
  type GameState,
  type HouseRules,
  type RoundState,
  type SpoolOption,
} from 'warp12-engine';

export interface HelmControls {
  showDraw: boolean;
  showDesperationDig: boolean;
  showShieldsDown: boolean;
  showShieldsUp: boolean;
  showPassRedAlert: boolean;
  showPass: boolean;
  spoolOptions: readonly SpoolOption[];
}

/** Which helm control buttons should appear for the active captain. */
export function resolveHelmControls(input: {
  round: RoundState | null | undefined;
  handOwnerId: string;
  isMyTurn: boolean;
  houseRules: HouseRules;
  dropToImpulsePending: boolean;
  legalMovesCount: number;
  gameState?: GameState;
}): HelmControls {
  const {
    round,
    handOwnerId,
    isMyTurn,
    houseRules,
    gameState,
  } = input;

  if (!round || !isMyTurn) {
    return {
      showDraw: false,
      showDesperationDig: false,
      showShieldsDown: false,
      showShieldsUp: false,
      showPassRedAlert: false,
      showPass: false,
      spoolOptions: [],
    };
  }

  // Get spool options if Module Delta is enabled
  const spoolOptions = gameState
    ? getSpoolOptions(gameState, round, handOwnerId, houseRules)
    : [];

  const showDraw = canDrawFromUncharted(round, handOwnerId, houseRules);

  return {
    showDraw,
    // Inline go-out Eta gate (same as canDesperationDig) to avoid circular
    // export binding issues when gameState pulls the full engine graph.
    showDesperationDig: Boolean(
      showDraw &&
        gameState &&
        gameState.objective === 'go-out' &&
        gameState.modules.temporalDebt.enabled
    ),
    showShieldsDown: canDeployDistressBeacon(round, handOwnerId, { houseRules }),
    showShieldsUp: canRaiseShieldsManually(round, handOwnerId, houseRules),
    showPassRedAlert: canPassRedAlert(round, handOwnerId, { houseRules }),
    showPass: canPassTurn(round, handOwnerId, { houseRules }),
    spoolOptions,
  };
}
