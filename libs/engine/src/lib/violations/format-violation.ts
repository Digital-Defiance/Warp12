/** Player-facing text for engine violation codes. */
export function formatViolation(violation: string): string {
  switch (violation) {
    case 'DROP_TO_IMPULSE_NOT_REQUIRED':
      return 'Dropping to impulse is not required right now';
    case 'RETURN_TO_WARP_NOT_ALLOWED':
      return 'You cannot return to warp right now';
    default:
      return violation.replaceAll('_', ' ').toLowerCase();
  }
}
