/** Player-facing text for engine violation codes. */
export function formatViolation(violation: string): string {
  switch (violation) {
    case 'TREATY_NOT_REQUIRED':
      return 'dropping to impulse not required';
    default:
      return violation.replaceAll('_', ' ').toLowerCase();
  }
}
