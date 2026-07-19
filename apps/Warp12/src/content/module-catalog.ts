/**
 * Curated module catalog for `/modules` — operate steps + dual skill studies.
 * Points: `tools/nn/data/points-modules-rerun/module-analysis-summary.json` (2026-07-19).
 * Go-out: `tools/nn/data/go-out-modules/module-analysis-summary.json` (2026-07-19).
 * Normative detail: RULES.tex §VI (this page is a briefing, not a substitute).
 * Eleven lettered Modules (Alpha–Lambda); Subspace Fracture is core, not a Module.
 */

export type ModuleTaxonomy =
  | 'official'
  | 'promote'
  | 'warped-party'
  | 'warped'
  | 'skill-promote-squad';

/** Separate skill/luck instruments — do not average across objectives. */
export type ModuleStudyInstrument = 'points' | 'go-out';

/** Mid-game skill telemetry rolled up across Warp×fleet cells for one module. */
export interface ModuleStudyMetrics {
  readonly avgSkill: number;
  readonly skillDominant: number;
  readonly mixed: number;
  readonly luckDominant: number;
  readonly configs: number;
  readonly legalMoves: number;
  readonly constrainedPct: number;
  readonly spread: number;
  readonly uniquePips: number;
}

export interface ModuleStatRow {
  readonly id: string;
  /** Points-campaign / shared display name. */
  readonly label: string;
  /** Go-out fork name when RULES §VI renames the module. */
  readonly goOutLabel?: string;
  readonly greek: string;
  readonly taxonomy: ModuleTaxonomy;
  readonly points: ModuleStudyMetrics;
  /** Null when the module is unavailable under go-out (Epsilon). */
  readonly goOut: ModuleStudyMetrics | null;
  /** One-line concept blurb. */
  readonly gist: string;
  /** Captain-facing operating steps (how the module changes play). */
  readonly operate: readonly string[];
}

export interface ModuleStudyCampaignMeta {
  readonly totalGames: number;
  readonly totalConfigs: number;
  readonly generated: string;
  readonly source: string;
}

/** Aggregate study headers shown on the page (per instrument). */
export const MODULE_STUDY_META = {
  gamesPerCell: 500,
  method:
    'Commander self-play across Warp 9 / 12 / 15 / 18 × every legal fleet size × module configs (Zeta only on eligible even fleets). Four mid-game skill indicators per cell (legal moves ≥3, constrained tiles >50%, move-value spread ≥2, unique pips ≥5) summed to a 0–4 score. Points and go-out are separate instruments — forked modules are not averaged together. Separate from the continuous §8 skillIndex composites in the TEI paper.',
  points: {
    totalGames: 274_500,
    totalConfigs: 549,
    generated: '2026-07-19',
    source: 'tools/nn/data/points-modules-rerun/',
  } satisfies ModuleStudyCampaignMeta,
  goOut: {
    totalGames: 255_500,
    totalConfigs: 511,
    generated: '2026-07-19',
    source: 'tools/nn/data/go-out-modules/',
  } satisfies ModuleStudyCampaignMeta,
} as const;

function m(
  avgSkill: number,
  skillDominant: number,
  mixed: number,
  luckDominant: number,
  configs: number,
  legalMoves: number,
  constrainedPct: number,
  spread: number,
  uniquePips: number
): ModuleStudyMetrics {
  return {
    avgSkill,
    skillDominant,
    mixed,
    luckDominant,
    configs,
    legalMoves,
    constrainedPct,
    spread,
    uniquePips,
  };
}

/**
 * Display order: Official + spotlight stories first, then rating-safe singles,
 * then Warped. Zeta/Epsilon get dedicated narrative sections on the page.
 */
export const MODULE_CATALOG: readonly ModuleStatRow[] = [
  {
    id: 'official',
    label: 'Official Warp preset',
    greek: 'Preset',
    taxonomy: 'official',
    points: m(2.82, 32, 5, 1, 38, 2.1, 54, 3.1, 7.5),
    goOut: m(2.84, 32, 6, 0, 38, 2.2, 54, 3.3, 7.7),
    gist: 'Recommended living-room / online default.',
    operate: [
      'Enable Continuum (Alpha) + Salamander (Beta) + Drop to Impulse + All Stop! house rules.',
      'Leave Subspace Fracture off unless the table wants chicken-foot doubles.',
      'Warp 12 + rated intent → FFA TEI when eligibility clears; exhibition sets stay casual.',
    ],
  },
  {
    id: 'none',
    label: 'Baseline (Sections I–V only)',
    greek: '—',
    taxonomy: 'promote',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.7),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 56, 3.5, 8.0),
    gist: 'Core multi-trail Interstellar Dominoes with no optional modules.',
    operate: [
      'Deal, Spacedock, Warp Trails, Neutral Zone, Distress Beacons, Red Alert as in Manual I–V.',
      'No Flash, Hazard Marker, Sensor Grid, draft, squads, or pip penalties beyond core scoring.',
    ],
  },
  {
    id: 'iota',
    label: 'Double Down',
    greek: 'Iota',
    taxonomy: 'promote',
    points: m(3.0, 38, 0, 0, 38, 2.2, 59, 3.6, 8.1),
    goOut: m(3.0, 38, 0, 0, 38, 2.3, 58, 3.8, 8.3),
    gist: 'Doubles as weapons — study’s highest skill ceiling (3.00/4).',
    operate: [
      'Whenever you chart any double (own trail, Neutral Zone, or open opponent trail), the next captain immediately draws 2 from Uncharted (or Sensor Grid if pile is empty).',
      'Those draws land before their turn begins — time doubles to bloat the captain who threatens go-out.',
      'Red Alert on uncovered doubles still applies; Double Down is an extra forced draw, not a Red Alert substitute.',
    ],
  },
  {
    id: 'zeta',
    label: 'Fleet Squadrons',
    greek: 'Zeta',
    taxonomy: 'skill-promote-squad',
    points: m(2.94, 16, 1, 0, 17, 1.9, 60, 3.1, 7.5),
    goOut: m(2.94, 16, 1, 0, 17, 1.9, 60, 3.3, 7.6),
    gist: 'Equal squads share one Warp Trail and beacon; skillful team play.',
    operate: [
      'Online only (not local / pass-and-play). Need even fleet ≥4 dividing by squad size 2 or 3.',
      'In lobby: name squads and drag captains between crews; launch forms shared trails + bridge seating.',
      'Teammates chart onto one trail and share one Distress Beacon; squad channel for intra-crew hails.',
      'Rated Warp 12 writes Squad TEI (profile Squad Play) — never the FFA human ladder.',
    ],
  },
  {
    id: 'alpha',
    label: 'The Continuum',
    greek: 'Alpha',
    taxonomy: 'promote',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.8),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 56, 3.5, 8.0),
    gist: '0-0 on your own trail fires a round-long Continuum Flash.',
    operate: [
      'Chart 0-0 on your own Warp Trail → choose one Flash before helm passes (reverse order, peek Uncharted, wager, skip lowest, …).',
      '0-0 on Neutral Zone or another captain’s trail does not trigger Flash.',
      'Flash lasts the rest of the round (clears at score). Winning 0-0 still resolves Flash before the sector can close.',
    ],
  },
  {
    id: 'beta',
    label: 'Salamander Penalty',
    goOutLabel: 'Salamander Surge',
    greek: 'Beta',
    taxonomy: 'promote',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.8),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 56, 3.5, 8.0),
    gist:
      'Holding the highest double (maxPip-maxPip) at round end costs double its pips — Warp 12: 48, Warp 18: 72. Go-out: Salamander Surge (opponents draw 1 when you chart it).',
    operate: [
      'Points: From round 2 onward, if you still hold the Warp Factor’s highest double when scoring, that tile scores double its both-ends value (12-12 → 48, 18-18 → 72).',
      'Go-out: Salamander Surge — charting maxPip-maxPip from hand forces each opponent to draw 1.',
      'Round 1 never applies as Spacedock — that double is already on the table.',
      'With Continuum Salamander swap (points): the full doubled penalty can transfer to the highest-points captain instead.',
    ],
  },
  {
    id: 'gamma',
    label: 'Long-Range Sensor Sweep',
    greek: 'Gamma',
    taxonomy: 'promote',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.8),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 56, 3.5, 8.0),
    gist: 'Face-up Sensor Grid beside Uncharted Sectors.',
    operate: [
      'A market of 4–5 face-up coordinates sits beside the pile.',
      'When you must draw: Sensor Sweep (take from the grid) or Blind Jump (random from Uncharted).',
      'Grid refreshes as tiles leave — use intel to manage large-fleet decision density.',
    ],
  },
  {
    id: 'delta',
    label: 'Hot Potato / Warp Drive Spool',
    goOutLabel: 'Hot Potato / Warp Drive Spool',
    greek: 'Delta',
    taxonomy: 'promote',
    points: m(2.92, 35, 3, 0, 38, 2.1, 57, 3.2, 7.7),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 57, 3.6, 8.0),
    gist: 'Hazard Marker on Neutral Zone contact (+5 per pass while holding) plus optional Engaging Warp Drive draws.',
    operate: [
      'Hot Potato: round starter holds the Hazard Marker; charting to Neutral Zone takes the marker; each pass while holding it adds +5 to your round score (stacks).',
      'Warp Drive Spool: on your turn (not blocked by Red Alert / Fracture), engage to draw one-at-a-time until a mismatch (or Uncharted empties) — matches chart; the mismatch goes to hand and the spool stops (undrawn stay in Uncharted). If a matching double is drawn and the next tile cannot cover it (or Fracture cannot finish), retrieve the double to hand with the failed draw(s); no Red Alert / Fracture remains.',
      'Opposes Theta’s longest-trail race: NZ is convenient but radioactive; spooling stretches trails at hand-bloat risk.',
    ],
  },
  {
    id: 'eta',
    label: 'Temporal Debt',
    goOutLabel: 'Desperation Dig',
    greek: 'Eta',
    taxonomy: 'promote',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.7),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 56, 3.5, 8.0),
    gist: 'Blind draws accrue debt tokens worth +2 pips each at scoring. Go-out: Desperation Dig (optional dig up to 3; beacon open two turns).',
    operate: [
      'Points: Each Blind Jump from Uncharted Sectors → +1 debt token.',
      'Points: At round end: score += 2 × tokens (even if you go out). Tokens reset next round.',
      'Go-out: Desperation Dig — when stuck, optionally dig up to 3; chart the first playable; beacon stays open for your next two turns.',
      'Sensor Sweep draws (Gamma) do not accrue debt / are not a dig.',
    ],
  },
  {
    id: 'theta',
    label: 'Longest Trail Bonus',
    goOutLabel: 'Trail Momentum',
    greek: 'Theta',
    taxonomy: 'promote',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.7),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 56, 3.5, 8.0),
    gist: 'Longest personal Warp Trail(s) receive −3 at scoring. Go-out: Trail Momentum (extra turn at trail length ≥ 5, once/sector).',
    operate: [
      'Points: At round end, captain(s) with the longest personal Warp Trail get −3 (ties share the bonus).',
      'Go-out: Trail Momentum — first captain whose personal trail reaches length ≥ 5 earns one immediate extra turn (once per sector).',
      'No extra draw mechanic here — Engaging Warp Drive / Spool ships with Module Delta.',
      'Pairs with Delta’s NZ hazard: stretch your own trail while someone else risks the Hot Potato.',
    ],
  },
  {
    id: 'subspace-fracture',
    label: 'Subspace Fracture',
    greek: '—',
    taxonomy: 'promote',
    points: m(2.87, 33, 5, 0, 38, 2.1, 55, 3.2, 7.9),
    goOut: m(2.84, 32, 6, 0, 38, 2.2, 54, 3.5, 8.0),
    gist: 'Core chicken-foot on doubles (not a Module) — choose scope in lobby.',
    operate: [
      'Part of core multi-trail play, carried over as an opt-in lobby toggle — not one of the eleven lettered Modules.',
      'Pick scope: Own Trail / All Captains / All Doubles before launch.',
      'Covered doubles open fracture stabilizers that must be filled before navigation continues.',
      'Off in Official Warp — turn on only when the table wants chicken-foot complexity.',
    ],
  },
  {
    id: 'epsilon',
    label: 'Tactical Requisition (Drafting)',
    greek: 'Epsilon',
    taxonomy: 'warped-party',
    points: m(1.08, 0, 11, 27, 38, 1.3, 36, 2.1, 5.0),
    goOut: null,
    gist: 'Pack-and-pass drafting — party / social; never rates TEI. Unavailable under go-out.',
    operate: [
      'Instead of a blind deal: packs are dealt, captains draft one tile and pass residual packs until hands fill.',
      'Play then proceeds with your chosen loadout — mid-game skill indicators collapse (1.08/4 under points).',
      'Unavailable under go-out (RULES §VI). Exhibition / party only — Warped; rated sector toggles force casual when Epsilon is aboard.',
    ],
  },
  {
    id: 'kappa',
    label: 'Temporal Inversion',
    goOutLabel: 'Hand Exchange',
    greek: 'Kappa',
    taxonomy: 'warped',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.8),
    goOut: m(2.89, 35, 2, 1, 38, 2.4, 54, 3.7, 8.8),
    gist: 'Even rounds invert — highest hand wins; going out is catastrophic. Go-out: Hand Exchange on first non-Spacedock double.',
    operate: [
      'Points / odd rounds: normal tally (low hand / go-out → 0; lowest campaign wins).',
      'Points / even rounds: highest hand wins — everyone starts at the round’s top hand and subtracts their own.',
      'Go-out: Hand Exchange — first non-Spacedock double triggers unique most vs fewest hands (steal 1, give 1 back); ties skip for the sector.',
      'Warped by design — exhibition only; never TEI.',
    ],
  },
  {
    id: 'lambda',
    label: 'Wormholes',
    greek: 'Lambda',
    taxonomy: 'warped',
    points: m(2.89, 34, 4, 0, 38, 2.1, 57, 3.2, 7.8),
    goOut: m(2.97, 37, 1, 0, 38, 2.2, 57, 3.5, 8.0),
    gist: 'Double on Neutral Zone swaps your trail with NZ ownership.',
    operate: [
      'Chart a double onto the Neutral Zone → your personal trail and NZ swap immediately.',
      'Active Distress Beacon is destroyed in transit; Red Alert must be answered on the newly acquired trail.',
      'Warped / exhibition — topological chaos; never TEI.',
    ],
  },
];

export function taxonomyLabel(taxonomy: ModuleTaxonomy): string {
  switch (taxonomy) {
    case 'official':
      return 'Official preset';
    case 'promote':
      return 'Promote (rated-safe)';
    case 'skill-promote-squad':
      return 'Skill-promote · Squad TEI';
    case 'warped-party':
      return 'Warped / party';
    case 'warped':
      return 'Warped / exhibition';
  }
}

export function studyMetaFor(
  instrument: ModuleStudyInstrument
): ModuleStudyCampaignMeta {
  return instrument === 'points'
    ? MODULE_STUDY_META.points
    : MODULE_STUDY_META.goOut;
}

export function metricsFor(
  row: ModuleStatRow,
  instrument: ModuleStudyInstrument
): ModuleStudyMetrics | null {
  return instrument === 'points' ? row.points : row.goOut;
}

export function labelFor(
  row: ModuleStatRow,
  instrument: ModuleStudyInstrument
): string {
  if (instrument === 'go-out' && row.goOutLabel) {
    return row.goOutLabel;
  }
  return row.label;
}

export function formatSkill(metrics: ModuleStudyMetrics): string {
  return `${metrics.avgSkill.toFixed(2)}/4`;
}

export function formatMix(metrics: ModuleStudyMetrics): string {
  return `${metrics.skillDominant}/${metrics.mixed}/${metrics.luckDominant}`;
}
