/**
 * Curated module catalog for `/modules` — operate steps + 285k-game skill study.
 * Stats from `tools/nn/data/module-analysis-summary.json` (2026-07-14).
 * Normative detail: RULES.tex §VI (this page is a briefing, not a substitute).
 * Eleven lettered Modules (Alpha–Lambda); Subspace Fracture is core, not a Module.
 */

export type ModuleTaxonomy =
  | 'official'
  | 'promote'
  | 'warped-party'
  | 'warped'
  | 'skill-promote-squad';

export interface ModuleStatRow {
  readonly id: string;
  readonly label: string;
  readonly greek: string;
  readonly taxonomy: ModuleTaxonomy;
  readonly avgSkill: number;
  readonly skillDominant: number;
  readonly mixed: number;
  readonly luckDominant: number;
  readonly configs: number;
  readonly legalMoves: number;
  readonly constrainedPct: number;
  readonly spread: number;
  readonly uniquePips: number;
  /** One-line concept blurb. */
  readonly gist: string;
  /** Captain-facing operating steps (how the module changes play). */
  readonly operate: readonly string[];
}

/** Aggregate study header shown on the page. */
export const MODULE_STUDY_META = {
  totalGames: 285_000,
  totalConfigs: 570,
  gamesPerCell: 500,
  generated: '2026-07-14',
  method:
    'Commander self-play across Warp 9 / 12 / 15 / 18 × every legal fleet size × 15 module configs. Four mid-game skill indicators per cell (legal moves ≥3, constrained tiles >50%, move-value spread ≥2, unique pips ≥5) summed to a 0–4 score. Separate from the continuous §8 skillIndex composites in the TEI paper.',
} as const;

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
    avgSkill: 2.82,
    skillDominant: 32,
    mixed: 5,
    luckDominant: 1,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 54,
    spread: 3.1,
    uniquePips: 7.5,
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
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.7,
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
    avgSkill: 3.0,
    skillDominant: 38,
    mixed: 0,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.2,
    constrainedPct: 59,
    spread: 3.6,
    uniquePips: 8.1,
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
    avgSkill: 2.92,
    skillDominant: 35,
    mixed: 3,
    luckDominant: 0,
    configs: 38,
    legalMoves: 1.9,
    constrainedPct: 60,
    spread: 3.3,
    uniquePips: 7.4,
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
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.8,
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
    greek: 'Beta',
    taxonomy: 'promote',
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.8,
    gist:
      'Holding the highest double (maxPip-maxPip) at round end costs double its pips — Warp 12: 48, Warp 18: 72.',
    operate: [
      'From round 2 onward, if you still hold the Warp Factor’s highest double when scoring, that tile scores double its both-ends value (12-12 → 48, 18-18 → 72).',
      'Round 1 never applies — that double is Spacedock.',
      'With Continuum Salamander swap: the full doubled penalty can transfer to the highest-points captain instead.',
    ],
  },
  {
    id: 'gamma',
    label: 'Long-Range Sensor Sweep',
    greek: 'Gamma',
    taxonomy: 'promote',
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.7,
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
    greek: 'Delta',
    taxonomy: 'promote',
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.7,
    gist: 'Hazard Marker on Neutral Zone contact (+5 per pass while holding) plus optional Engaging Warp Drive draws.',
    operate: [
      'Hot Potato: round starter holds the Hazard Marker; charting to Neutral Zone takes the marker; each pass while holding it adds +5 to your round score (stacks).',
      'Warp Drive Spool: on your turn (not blocked by Red Alert / Fracture), engage to draw until a mismatch for a chosen route — matches chart, mismatch + leftovers to hand.',
      'Opposes Theta’s longest-trail race: NZ is convenient but radioactive; spooling stretches trails at hand-bloat risk.',
    ],
  },
  {
    id: 'eta',
    label: 'Temporal Debt',
    greek: 'Eta',
    taxonomy: 'promote',
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.7,
    gist: 'Blind draws accrue debt tokens worth +2 pips each at scoring.',
    operate: [
      'Each Blind Jump from Uncharted Sectors → +1 debt token.',
      'At round end: score += 2 × tokens (even if you go out). Tokens reset next round.',
      'Sensor Sweep draws (Gamma) do not accrue debt — visible market, not blind chance.',
    ],
  },
  {
    id: 'theta',
    label: 'Longest Trail Bonus',
    greek: 'Theta',
    taxonomy: 'promote',
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.7,
    gist: 'Longest personal Warp Trail(s) receive −3 at scoring.',
    operate: [
      'At round end, captain(s) with the longest personal Warp Trail get −3 (ties share the bonus).',
      'Bonus cannot push that captain’s round total below 0.',
      'No extra draw mechanic here — Engaging Warp Drive / Spool ships with Module Delta.',
      'Pairs with Delta’s NZ hazard: stretch your own trail while someone else risks the Hot Potato.',
    ],
  },
  {
    id: 'subspace-fracture',
    label: 'Subspace Fracture',
    greek: '—',
    taxonomy: 'promote',
    avgSkill: 2.87,
    skillDominant: 33,
    mixed: 5,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 55,
    spread: 3.2,
    uniquePips: 7.9,
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
    avgSkill: 1.08,
    skillDominant: 0,
    mixed: 11,
    luckDominant: 27,
    configs: 38,
    legalMoves: 1.3,
    constrainedPct: 36,
    spread: 2.1,
    uniquePips: 5.0,
    gist: 'Pack-and-pass drafting — party / social; never rates TEI.',
    operate: [
      'Instead of a blind deal: packs are dealt, captains draft one tile and pass residual packs until hands fill.',
      'Play then proceeds with your chosen loadout — mid-game skill indicators collapse (1.08/4).',
      'Exhibition / party only — Warped; rated sector toggles force casual when Epsilon is aboard.',
    ],
  },
  {
    id: 'kappa',
    label: 'Temporal Inversion',
    greek: 'Kappa',
    taxonomy: 'warped',
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.8,
    gist: 'Even rounds invert — highest hand wins; going out is catastrophic.',
    operate: [
      'Odd rounds: normal tally (low hand / go-out → 0; lowest campaign wins).',
      'Even rounds: highest hand wins — everyone starts at the round’s top hand and subtracts their own; the biggest hand nets 0, going out takes the full baseline.',
      'Warped by design — exhibition only; never TEI.',
    ],
  },
  {
    id: 'lambda',
    label: 'Wormholes',
    greek: 'Lambda',
    taxonomy: 'warped',
    avgSkill: 2.89,
    skillDominant: 34,
    mixed: 4,
    luckDominant: 0,
    configs: 38,
    legalMoves: 2.1,
    constrainedPct: 57,
    spread: 3.2,
    uniquePips: 7.7,
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
