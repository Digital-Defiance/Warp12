/**
 * Pure TEI gate for practice (local vs-AI) matches — no Firebase imports so
 * vitest can cover it without mocking admin.
 */
export function practiceMatchTeiEligible(input: {
  readonly configEligible: boolean;
  readonly advisorUsed: boolean;
  readonly devToolsUsed: boolean;
  readonly isAdmin: boolean;
}): boolean {
  if (!input.configEligible) {
    return false;
  }
  if (input.advisorUsed) {
    return false;
  }
  if (input.devToolsUsed && !input.isAdmin) {
    return false;
  }
  return true;
}
