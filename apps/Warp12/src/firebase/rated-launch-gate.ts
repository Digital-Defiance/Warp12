/**
 * Client soft-gate for rated online launch. Anonymous hosts must upgrade
 * (Google) or turn off Rated — unless Playwright sets the e2e allow flag.
 */
export function isRatedLaunchBlocked(args: {
  readonly wantsRated: boolean;
  readonly isAnonymous: boolean;
  readonly e2eAllowRatedAnonymous?: boolean;
}): boolean {
  if (!args.wantsRated || !args.isAnonymous) {
    return false;
  }
  return args.e2eAllowRatedAnonymous !== true;
}

export const RATED_LAUNCH_SOFT_GATE_MESSAGE =
  'Sign in with Google before launching a rated sector — or turn off Rated sector below.';
