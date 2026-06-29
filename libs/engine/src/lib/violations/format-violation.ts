/** Player-facing text for engine violation codes. */
export function formatViolation(violation: string): string {
  switch (violation) {
    case 'ALL_STOP_NOT_REQUIRED':
      return 'All Stop! is not required right now';
    case 'DROP_TO_IMPULSE_NOT_REQUIRED':
      return 'Drop to Impulse! is not required right now';
    case 'CATCH_DROP_TO_IMPULSE_NOT_ALLOWED':
      return 'You cannot catch Drop to Impulse right now';
    case 'RETURN_TO_WARP_NOT_ALLOWED':
      return 'You cannot return to warp right now';
    default:
      return violation.replaceAll('_', ' ').toLowerCase();
  }
}
