/**
 * Quick-comms canned phrases — the "subspace hail" wheel. These are the only
 * comms allowed during a live rated sector (free-form chat and DMs are gated to
 * the lobby, unrated sectors, and post-game). Phrases are intentionally social
 * and never convey hand or strategy information, so they cannot be used to
 * collude. Each group's `icon` is an SVG served from `/public`.
 */

export interface QuickCommPhrase {
  /** Stable id persisted on the message document. */
  readonly id: string;
  readonly text: string;
}

export interface QuickCommGroup {
  readonly id: string;
  readonly label: string;
  /** SVG filename in `apps/Warp12/public`. */
  readonly icon: string;
  readonly phrases: readonly QuickCommPhrase[];
}

export const QUICK_COMM_GROUPS: readonly QuickCommGroup[] = [
  {
    id: 'acknowledge',
    label: 'Acknowledge',
    icon: 'face-saluting-duotone-solid-full.svg',
    phrases: [
      { id: 'ack-aye-captain', text: 'Aye, Captain' },
      { id: 'ack-acknowledged', text: 'Acknowledged' },
      { id: 'ack-make-it-so', text: 'Make it so' },
      { id: 'ack-course-laid-in', text: 'Course laid in' },
    ],
  },
  {
    id: 'get-moving',
    label: 'Get moving',
    icon: 'rabbit-running-sharp-duotone-solid-full.svg',
    phrases: [
      { id: 'move-engage', text: 'Engage!' },
      { id: 'move-punch-it', text: 'Punch it' },
      { id: 'move-warp-speed', text: 'Warp speed' },
      { id: 'move-ahead-full', text: 'Ahead full' },
      { id: 'move-steady', text: 'Steady as she goes' },
    ],
  },
  {
    id: 'sportsmanship',
    label: 'Sportsmanship',
    icon: 'court-sport-duotone-thin-full.svg',
    phrases: [
      { id: 'sport-well-played', text: 'Well played' },
      { id: 'sport-fine-maneuver', text: 'A fine maneuver' },
      { id: 'sport-needs-of-many', text: 'The needs of the many…' },
      { id: 'sport-fly-well', text: 'Fly well, Captain' },
    ],
  },
  {
    id: 'drama',
    label: 'Drama',
    icon: 'masks-theater-sharp-duotone-light-full.svg',
    phrases: [
      { id: 'drama-red-alert', text: 'Red Alert!' },
      { id: 'drama-shields-up', text: 'Shields up!' },
      { id: 'drama-all-stop', text: 'All Stop!' },
      { id: 'drama-distress-beacon', text: 'Distress beacon away' },
      { id: 'drama-breaking-up', text: "She's breaking up!" },
      { id: 'drama-fascinating', text: 'Fascinating…' },
      { id: 'drama-bold', text: 'Bold. Very bold.' },
    ],
  },
  {
    id: 'cheeky',
    label: 'Cheeky',
    icon: 'face-grin-tongue-duotone-solid-full.svg',
    phrases: [
      { id: 'cheeky-dangerous-game', text: "You're playing a dangerous game" },
      { id: 'cheeky-persistence-futile', text: 'Persistence is futile' },
      { id: 'cheeky-resistance-noted', text: 'Resistance is… noted' },
      { id: 'cheeky-conn', text: 'I have the conn now' },
      { id: 'cheeky-q-proud', text: 'Q would be proud' },
    ],
  },
];

const PHRASE_BY_ID: ReadonlyMap<string, QuickCommPhrase> = new Map(
  QUICK_COMM_GROUPS.flatMap((group) =>
    group.phrases.map((phrase) => [phrase.id, phrase] as const)
  )
);

/** Resolve a persisted phrase id back to its text (for rendering messages). */
export function quickCommPhraseById(id: string): QuickCommPhrase | null {
  return PHRASE_BY_ID.get(id) ?? null;
}

export function isQuickCommPhraseId(id: string): boolean {
  return PHRASE_BY_ID.has(id);
}
