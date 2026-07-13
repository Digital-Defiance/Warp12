import { useEffect } from 'react';

import type { GameState } from 'warp12-engine';

import styles from './rules-view.module.scss';
import settingStyles from './sector-settings-dialog.module.scss';

export interface SectorSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  game: GameState;
}

function onOff(value: boolean): string {
  return value ? 'On' : 'Off';
}

const SCOPE_LABELS: Record<string, string> = {
  'own-trail': 'Own Trail',
  'all-captains': 'All Captains',
  'all-doubles': 'All Doubles',
};

interface SettingRow {
  label: string;
  value: string;
}

function buildSections(game: GameState): { title: string; rows: SettingRow[] }[] {
  const { modules, houseRules } = game;
  const objective =
    game.objective === 'points'
      ? `Points campaign — ${game.campaignRounds} round${
          game.campaignRounds === 1 ? '' : 's'
        }`
      : 'Go out (first to empty their hand)';

  return [
    {
      title: 'Objective',
      rows: [{ label: 'Mode', value: objective }],
    },
    {
      title: 'Modules',
      rows: [
        { label: 'Module Alpha — Continuum', value: onOff(modules.continuum.enabled) },
        {
          label: 'Module Beta — Salamander Penalty',
          value: onOff(modules.salamanderPenalty.enabled),
        },
        {
          label: 'Module Gamma — Sensor Grid',
          value: onOff(modules.sensorGrid.enabled),
        },
        {
          label: 'Module Delta — Hot Potato (Warp Drive Spool)',
          value: onOff(modules.warpDriveSpool.enabled),
        },
        {
          label: 'Module Theta — Longest Trail Bonus',
          value: onOff(modules.longestTrail.enabled),
        },
        {
          label: 'Module Iota — Double Down',
          value: onOff(modules.doubleDown.enabled),
        },
        {
          label: 'Module Kappa — Temporal Inversion',
          value: onOff(modules.temporalInversion.enabled),
        },
        {
          label: 'Subspace Fracture',
          value: modules.subspaceFracture.enabled
            ? `On — ${SCOPE_LABELS[modules.subspaceFracture.scope] ?? modules.subspaceFracture.scope}`
            : 'Off',
        },
      ],
    },
    {
      title: 'Scoring',
      rows: [
        {
          label: 'Double-blank (0-0) score',
          value:
            houseRules.doubleZeroScore === 50
              ? '50 (tournament standard)'
              : houseRules.doubleZeroScore === 25
                ? '25'
                : '0 (pips)',
        },
      ],
    },
    {
      title: 'House rules',
      rows: [
        {
          label: 'Drop to Impulse',
          value: houseRules.dropToImpulseCall
            ? `On — ${houseRules.dropToImpulseCatchPenalty}-tile catch`
            : 'Off',
        },
        { label: 'All Stop! ceremony', value: onOff(houseRules.allStopCeremony) },
        {
          label: 'Manual shield control',
          value: onOff(houseRules.manualShieldControl),
        },
        {
          label: 'Pass Red Alert without draw or beacon',
          value: onOff(houseRules.passRedAlertWithoutDraw),
        },
        {
          label: 'Require own trail first',
          value: onOff(houseRules.requireOwnTrailFirst),
        },
        {
          label: 'Neutral Zone after all trails',
          value: onOff(houseRules.neutralZoneAfterAllTrails),
        },
        {
          label: 'Beacon clears on any play',
          value: onOff(houseRules.beaconClearsOnAnyPlay),
        },
        {
          label: 'Round starter plays two',
          value: onOff(houseRules.roundStarterPlaysTwo),
        },
        {
          label: '  → Own trail only',
          value: houseRules.roundStarterPlaysTwo
            ? onOff(houseRules.roundStarterOwnTrailOnly)
            : '—',
        },
      ],
    },
  ];
}

/** Read-only summary of the rules in force for the current sector. */
export function SectorSettingsDialog({
  open,
  onClose,
  game,
}: SectorSettingsDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const sections = buildSections(game);

  return (
    <div
      className={styles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-sector-settings-title"
      onClick={onClose}
    >
      <div
        className={`${styles.dialogPanel} ${settingStyles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-sector-settings-title" className={styles.dialogTitle}>
            Sector rules
          </h2>
          <button type="button" className={styles.dialogClose} onClick={onClose}>
            Close
          </button>
        </header>
        <div className={styles.dialogBody}>
          <p className={settingStyles.note}>
            The rules in force for this sector (read-only). Set before launch.
          </p>
          {sections.map((section) => (
            <section key={section.title} className={settingStyles.section}>
              <h3 className={settingStyles.sectionTitle}>{section.title}</h3>
              <dl className={settingStyles.list}>
                {section.rows.map((row) => (
                  <div key={row.label} className={settingStyles.row}>
                    <dt className={settingStyles.term}>{row.label}</dt>
                    <dd className={settingStyles.value}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
