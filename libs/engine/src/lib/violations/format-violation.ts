/** Player-facing text for engine violation codes. */
export function formatViolation(violation: string): string {
  switch (violation) {
    case 'ALL_STOP_NOT_REQUIRED':
      return 'All Stop! is not required right now';
    case 'DROP_TO_IMPULSE_NOT_REQUIRED':
      return 'Drop to Impulse! is not required right now';
    case 'CATCH_DROP_TO_IMPULSE_NOT_ALLOWED':
      return 'You cannot catch Drop to Impulse right now';
    case 'RAISE_SHIELDS_NOT_ALLOWED':
      return 'You cannot raise shields right now';
    case 'TURN_CHART_LIMIT':
      return 'Pass helm or adjust shields before charting again';
    case 'DRAW_NOT_ALLOWED':
      return 'You can only draw once when unable to chart';
    default:
      return violation.replaceAll('_', ' ').toLowerCase();
  }
}
