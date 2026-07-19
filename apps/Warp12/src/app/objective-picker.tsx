import {
  clampCampaignRounds,
  clampGoOutWinsToWin,
  DEFAULT_GO_OUT_OVERTIME,
  DEFAULT_GO_OUT_STRUCTURE,
  DEFAULT_GO_OUT_WINS_TO_WIN,
  defaultCampaignRounds,
  GAME_OBJECTIVE_LABELS,
  GO_OUT_OVERTIME_LABELS,
  GO_OUT_STRUCTURE_LABELS,
  MIN_CAMPAIGN_ROUNDS,
  MIN_GO_OUT_WINS_TO_WIN,
  MAX_GO_OUT_WINS_TO_WIN,
  type GameObjective,
  type GoOutOvertimePolicy,
  type GoOutStructure,
} from 'warp12-engine';

import styles from './lobby.module.scss';

export interface ObjectivePickerProps {
  name: string;
  value: GameObjective;
  onChange?: (objective: GameObjective) => void;
  disabled?: boolean;
}

/** Points first — penalty is the default victory objective. */
const OBJECTIVE_OPTIONS = ['points', 'go-out'] as const satisfies readonly GameObjective[];
const GO_OUT_STRUCTURES = ['sudden-death', 'fixed-rounds', 'first-to'] as const satisfies readonly GoOutStructure[];
const GO_OUT_OVERTIMES = ['force', 'offer'] as const satisfies readonly GoOutOvertimePolicy[];

/** Go out vs points — shared by local setup and online sector host settings. */
export function ObjectivePicker({
  name,
  value,
  onChange,
  disabled = false,
}: ObjectivePickerProps) {
  const readOnly = !onChange;

  return (
    <fieldset className={styles.fieldset}>
      <legend>Victory objective</legend>
      {OBJECTIVE_OPTIONS.map((objective) => (
        <label key={objective} className={styles.radioRow}>
          <input
            type="radio"
            name={name}
            value={objective}
            checked={value === objective}
            disabled={disabled || readOnly}
            onChange={() => onChange?.(objective)}
            onClick={() => {
              // Controlled radios can miss change events when the value is
              // still the prior option in React state (async lobby writes).
              if (!disabled && !readOnly && value !== objective) {
                onChange?.(objective);
              }
            }}
          />
          <span>{GAME_OBJECTIVE_LABELS[objective]}</span>
        </label>
      ))}
    </fieldset>
  );
}

export interface CampaignRoundsFieldProps {
  value: number;
  onChange?: (rounds: number) => void;
  disabled?: boolean;
  /** Warp factor — caps campaign length (10 / 13 / 16 / 19). */
  maxPip?: number;
}

/** Penalty campaign length — shown when the points objective is selected. */
export function CampaignRoundsField({
  value,
  onChange,
  disabled = false,
  maxPip = 12,
}: CampaignRoundsFieldProps) {
  const readOnly = !onChange;
  const maxRounds = defaultCampaignRounds(maxPip);
  const clamped = clampCampaignRounds(value, maxPip);

  return (
    <label className={styles.field}>
      <span>
        Campaign length ({MIN_CAMPAIGN_ROUNDS}–{maxRounds} rounds)
      </span>
      <select
        aria-label="Campaign length"
        value={clamped}
        disabled={disabled || readOnly}
        onChange={(event) =>
          onChange?.(clampCampaignRounds(Number(event.target.value), maxPip))
        }
      >
        {Array.from(
          { length: maxRounds - MIN_CAMPAIGN_ROUNDS + 1 },
          (_, index) => MIN_CAMPAIGN_ROUNDS + index
        ).map((rounds) => (
          <option key={rounds} value={rounds}>
            {rounds} round{rounds === 1 ? '' : 's'}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Go-out campaign controls
// ---------------------------------------------------------------------------

export interface GoOutCampaignConfig {
  goOutStructure: GoOutStructure;
  goOutWinsToWin: number;
  goOutOvertime: GoOutOvertimePolicy;
  /** For fixed-rounds: number of Spacedock rounds to play. */
  campaignRounds: number;
}

export interface GoOutCampaignFieldProps {
  name: string;
  value: GoOutCampaignConfig;
  onChange?: (config: GoOutCampaignConfig) => void;
  disabled?: boolean;
  maxPip?: number;
}

/** Go-out campaign structure — shown when objective is go-out. */
export function GoOutCampaignField({
  name,
  value,
  onChange,
  disabled = false,
  maxPip = 12,
}: GoOutCampaignFieldProps) {
  const readOnly = !onChange;
  const maxRounds = defaultCampaignRounds(maxPip);
  const maxCampaignRounds = clampCampaignRounds(value.campaignRounds, maxPip);

  const set = (patch: Partial<GoOutCampaignConfig>) =>
    onChange?.({ ...value, ...patch });

  return (
    <fieldset className={styles.fieldset}>
      <legend>Go-out sector structure</legend>
      {GO_OUT_STRUCTURES.map((structure) => (
        <label key={structure} className={styles.radioRow}>
          <input
            type="radio"
            name={`${name}-go-out-structure`}
            value={structure}
            checked={value.goOutStructure === structure}
            disabled={disabled || readOnly}
            onChange={() => set({ goOutStructure: structure })}
          />
          <span>{GO_OUT_STRUCTURE_LABELS[structure]}</span>
        </label>
      ))}

      {value.goOutStructure === 'fixed-rounds' && (
        <>
          <label className={styles.field} style={{ marginTop: '0.5rem' }}>
            <span>
              Campaign length ({MIN_CAMPAIGN_ROUNDS}–{maxRounds} rounds)
            </span>
            <select
              aria-label="Campaign length"
              value={maxCampaignRounds}
              disabled={disabled || readOnly}
              onChange={(e) =>
                set({
                  campaignRounds: clampCampaignRounds(Number(e.target.value), maxPip),
                })
              }
            >
              {Array.from(
                { length: maxRounds - MIN_CAMPAIGN_ROUNDS + 1 },
                (_, i) => MIN_CAMPAIGN_ROUNDS + i
              ).map((r) => (
                <option key={r} value={r}>
                  {r} round{r === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={styles.fieldset} style={{ marginTop: '0.5rem' }}>
            <legend>Tie-break overtime</legend>
            {GO_OUT_OVERTIMES.map((policy) => (
              <label key={policy} className={styles.radioRow}>
                <input
                  type="radio"
                  name={`${name}-go-out-overtime`}
                  value={policy}
                  checked={value.goOutOvertime === policy}
                  disabled={disabled || readOnly}
                  onChange={() => set({ goOutOvertime: policy })}
                />
                <span>{GO_OUT_OVERTIME_LABELS[policy]}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}

      {value.goOutStructure === 'first-to' && (
        <label className={styles.field} style={{ marginTop: '0.5rem' }}>
          <span>
            Wins to win the sector ({MIN_GO_OUT_WINS_TO_WIN}–{MAX_GO_OUT_WINS_TO_WIN})
          </span>
          <select
            aria-label="Wins to win"
            value={clampGoOutWinsToWin(value.goOutWinsToWin)}
            disabled={disabled || readOnly}
            onChange={(e) =>
              set({ goOutWinsToWin: clampGoOutWinsToWin(Number(e.target.value)) })
            }
          >
            {Array.from(
              { length: MAX_GO_OUT_WINS_TO_WIN - MIN_GO_OUT_WINS_TO_WIN + 1 },
              (_, i) => MIN_GO_OUT_WINS_TO_WIN + i
            ).map((w) => (
              <option key={w} value={w}>
                {w} win{w === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}

/** Default GoOutCampaignConfig for initial state. */
export function defaultGoOutCampaignConfig(maxPip = 12): GoOutCampaignConfig {
  return {
    goOutStructure: DEFAULT_GO_OUT_STRUCTURE,
    goOutWinsToWin: DEFAULT_GO_OUT_WINS_TO_WIN,
    goOutOvertime: DEFAULT_GO_OUT_OVERTIME,
    campaignRounds: defaultCampaignRounds(maxPip),
  };
}

// ---------------------------------------------------------------------------
// Match starter picker
// ---------------------------------------------------------------------------

export interface StarterOption {
  readonly id: string;
  readonly displayName: string;
}

export interface MatchStarterPickerProps {
  captains: readonly StarterOption[];
  /** Index into captains (not id). -1 = none selected / host picks. */
  value: number;
  onChange?: (index: number) => void;
  disabled?: boolean;
}

/**
 * Dropdown for choosing which captain opens the first round.
 * Used in local-game-page, pass-and-play-page, lobby-form, and online-lobby-page.
 */
export function MatchStarterPicker({
  captains,
  value,
  onChange,
  disabled = false,
}: MatchStarterPickerProps) {
  const readOnly = !onChange;
  const safeValue = value >= 0 && value < captains.length ? value : -1;

  return (
    <label className={styles.field}>
      <span>First-round starter</span>
      <select
        aria-label="First-round starter"
        value={safeValue}
        disabled={disabled || readOnly}
        onChange={(e) => onChange?.(Number(e.target.value))}
      >
        <option value={-1}>Random (engine picks)</option>
        {captains.map((captain, index) => (
          <option key={captain.id} value={index}>
            {captain.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// ObjectiveSummary (read-only for joiners)
// ---------------------------------------------------------------------------

export interface ObjectiveSummaryProps {
  objective: GameObjective;
  campaignRounds?: number;
  goOutStructure?: GoOutStructure;
  goOutWinsToWin?: number;
}

/** Read-only objective for joiners in the waiting room. */
export function ObjectiveSummary({
  objective,
  campaignRounds,
  goOutStructure,
  goOutWinsToWin,
}: ObjectiveSummaryProps) {
  return (
    <>
      <fieldset className={`${styles.fieldset} ${styles.readOnlyFieldset}`}>
        <legend>Victory objective</legend>
        {OBJECTIVE_OPTIONS.map((value) => (
          <label
            key={value}
            className={`${styles.radioRow} ${
              value === objective ? styles.radioRowSelected : styles.radioRowMuted
            }`}
          >
            <input
              type="radio"
              name="sector-objective-summary"
              checked={value === objective}
              tabIndex={-1}
              onChange={() => {}}
            />
            <span>{GAME_OBJECTIVE_LABELS[value]}</span>
          </label>
        ))}
      </fieldset>
      {objective === 'points' && campaignRounds != null && (
        <fieldset className={`${styles.fieldset} ${styles.readOnlyFieldset}`}>
          <legend>Campaign length</legend>
          <p className={styles.subtitle}>
            {campaignRounds} round{campaignRounds === 1 ? '' : 's'}
          </p>
        </fieldset>
      )}
      {objective === 'go-out' &&
        goOutStructure != null &&
        goOutStructure !== 'sudden-death' && (
          <fieldset className={`${styles.fieldset} ${styles.readOnlyFieldset}`}>
            <legend>Go-out structure</legend>
            <p className={styles.subtitle}>
              {goOutStructure === 'fixed-rounds' &&
                campaignRounds != null &&
                `Fixed rounds — ${campaignRounds} round${campaignRounds === 1 ? '' : 's'}`}
              {goOutStructure === 'first-to' &&
                goOutWinsToWin != null &&
                `First to ${goOutWinsToWin} win${goOutWinsToWin === 1 ? '' : 's'}`}
            </p>
          </fieldset>
        )}
    </>
  );
}
