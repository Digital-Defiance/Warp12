import { useEffect, useId, useMemo, useState } from 'react';
import {
  formatAiSkillUnratedLabel,
  type WarpSkillLevel,
} from 'warp12-engine';

import { useAnnounce } from '../a11y/live-announcer';
import { copyTextToClipboard } from '../game/deliver-file.js';
import { isAiCaptain } from '../game/ai-captain.js';
import { sectorInviteLinks } from '../game/sector-invite-urls.js';
import type { FirestoreCaptain } from '../firebase/schema.js';
import type { PlayerReportCategory } from '../firebase/moderation-reports.js';

import styles from './rules-view.module.scss';
import confirmStyles from './confirm-dialog.module.scss';
import modStyles from './host-mod-dialog.module.scss';

const REPORT_CATEGORIES: ReadonlyArray<{
  value: PlayerReportCategory;
  label: string;
}> = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'cheating', label: 'Cheating' },
  { value: 'inappropriate-name', label: 'Inappropriate name' },
  { value: 'other', label: 'Other' },
];

const SKILL_OPTIONS: readonly WarpSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];

function MaskIcon({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={[modStyles.iconMask, className].filter(Boolean).join(' ')}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
      }}
      aria-hidden
    />
  );
}

export interface HostModDialogProps {
  open: boolean;
  onClose: () => void;
  sectorCode: string;
  sectorPaused: boolean;
  allowSpectate: boolean;
  spectatorCount: number;
  captains: readonly FirestoreCaptain[];
  hostId: string;
  busy?: boolean;
  onPause: () => void | Promise<void>;
  onResume: () => void | Promise<void>;
  onDissolve: () => void | Promise<void>;
  onClearSpectators: () => void | Promise<void>;
  onSetAllowSpectate: (allow: boolean) => void | Promise<void>;
  onReportCaptain: (input: {
    targetUid: string;
    category: PlayerReportCategory;
    reason: string;
  }) => Promise<{ alreadySubmitted: boolean }>;
  onDropCaptain: (targetUid: string) => void | Promise<void>;
  onReplaceWithAi: (
    targetUid: string,
    skill: WarpSkillLevel
  ) => void | Promise<void>;
  onMuteCaptain: (targetUid: string, reason: string) => void | Promise<void>;
  onTransferHost: (newHostId: string) => void | Promise<void>;
}

export function HostModDialog({
  open,
  onClose,
  sectorCode,
  sectorPaused,
  allowSpectate,
  spectatorCount,
  captains,
  hostId,
  busy = false,
  onPause,
  onResume,
  onDissolve,
  onClearSpectators,
  onSetAllowSpectate,
  onReportCaptain,
  onDropCaptain,
  onReplaceWithAi,
  onMuteCaptain,
  onTransferHost,
}: HostModDialogProps) {
  const titleId = useId();
  const announce = useAnnounce();
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDissolve, setConfirmDissolve] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [selectedUid, setSelectedUid] = useState('');
  const [transferUid, setTransferUid] = useState('');
  const [replaceSkill, setReplaceSkill] =
    useState<WarpSkillLevel>('lieutenant');
  const [reportOpen, setReportOpen] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [muteReason, setMuteReason] = useState('');
  const [reportCategory, setReportCategory] =
    useState<PlayerReportCategory>('harassment');
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const selectable = useMemo(
    () => captains.filter((captain) => captain.id !== hostId),
    [captains, hostId]
  );

  const transferCandidates = useMemo(
    () =>
      captains.filter(
        (captain) => captain.id !== hostId && !isAiCaptain(captain)
      ),
    [captains, hostId]
  );

  const selected = selectable.find((captain) => captain.id === selectedUid);
  const selectedIsAi = selected ? isAiCaptain(selected) : false;

  useEffect(() => {
    if (!open) {
      return;
    }
    setStatus(null);
    setConfirmDissolve(false);
    setConfirmDrop(false);
    setConfirmReplace(false);
    setConfirmTransfer(false);
    setReportOpen(false);
    setMuteOpen(false);
    setReportReason('');
    setMuteReason('');
    setSelectedUid((current) =>
      selectable.some((captain) => captain.id === current)
        ? current
        : (selectable[0]?.id ?? '')
    );
    setTransferUid((current) =>
      transferCandidates.some((captain) => captain.id === current)
        ? current
        : (transferCandidates[0]?.id ?? '')
    );
  }, [open, selectable, transferCandidates]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !reporting) {
        if (
          confirmDissolve ||
          confirmDrop ||
          confirmReplace ||
          confirmTransfer ||
          reportOpen ||
          muteOpen
        ) {
          setConfirmDissolve(false);
          setConfirmDrop(false);
          setConfirmReplace(false);
          setConfirmTransfer(false);
          setReportOpen(false);
          setMuteOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    busy,
    confirmDissolve,
    confirmDrop,
    confirmReplace,
    confirmTransfer,
    muteOpen,
    onClose,
    open,
    reportOpen,
    reporting,
  ]);

  if (!open) {
    return null;
  }

  const setStatusMsg = (
    message: string,
    politeness: 'polite' | 'assertive' = 'polite'
  ) => {
    setStatus(message);
    announce(message, politeness);
  };

  const clearCaptainPanels = () => {
    setConfirmDrop(false);
    setConfirmReplace(false);
    setReportOpen(false);
    setMuteOpen(false);
  };

  return (
    <div
      className={styles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={busy || reporting ? undefined : onClose}
    >
      <div
        className={`${styles.dialogPanel} ${confirmStyles.panel} ${modStyles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id={titleId} className={styles.dialogTitle}>
            Host controls
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
            disabled={busy || reporting}
          >
            Close
          </button>
        </header>

        <div className={`${styles.dialogBody} ${modStyles.body}`}>
          <section className={modStyles.section} aria-label="Sector controls">
            <h3 className={modStyles.sectionTitle}>Sector</h3>
            <p className={modStyles.hint} role="status">
              {allowSpectate
                ? `${spectatorCount} spectator${spectatorCount === 1 ? '' : 's'} watching`
                : 'Spectator gallery closed'}
            </p>
            <div className={modStyles.iconRow}>
              {sectorPaused ? (
                <button
                  type="button"
                  className={modStyles.iconBtn}
                  disabled={busy}
                  aria-label="Resume sector"
                  onClick={() => void onResume()}
                >
                  <MaskIcon src="/play-duotone-thin-full.svg" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  className={modStyles.iconBtn}
                  disabled={busy}
                  aria-label="Pause sector"
                  onClick={() => void onPause()}
                >
                  <MaskIcon src="/pause-duotone-thin-full.svg" />
                  Pause
                </button>
              )}
              <button
                type="button"
                className={modStyles.iconBtn}
                data-tone="danger"
                disabled={busy}
                aria-label="Dissolve sector"
                aria-expanded={confirmDissolve}
                onClick={() => {
                  setConfirmTransfer(false);
                  setConfirmDissolve(true);
                }}
              >
                <MaskIcon src="/stop-duotone-thin-full.svg" />
                Dissolve
              </button>
              <button
                type="button"
                className={modStyles.iconBtn}
                disabled={busy || spectatorCount === 0}
                aria-label="Clear spectator gallery"
                onClick={() => void onClearSpectators()}
              >
                <MaskIcon src="/users-slash-duotone-solid-full.svg" />
                Clear gallery
              </button>
            </div>

            <label className={modStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={allowSpectate}
                disabled={busy}
                onChange={(event) =>
                  void onSetAllowSpectate(event.target.checked)
                }
              />
              <MaskIcon
                src={
                  allowSpectate
                    ? '/eye-duotone-thin-full.svg'
                    : '/eye-slash-sharp-duotone-solid-full.svg'
                }
              />
              <span>Allow spectators</span>
            </label>

            {confirmDissolve ? (
              <div
                className={modStyles.confirmBox}
                role="group"
                aria-label="Confirm dissolve"
              >
                <p className={modStyles.hint}>
                  Dissolve this sector for everyone? The code will stop working.
                </p>
                <div className={modStyles.iconRow}>
                  <button
                    type="button"
                    className={confirmStyles.cancelBtn}
                    disabled={busy}
                    onClick={() => setConfirmDissolve(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={confirmStyles.confirmBtn}
                    data-tone="danger"
                    disabled={busy}
                    onClick={() => void onDissolve()}
                  >
                    Dissolve sector
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={modStyles.section} aria-label="Transfer host">
            <h3 className={modStyles.sectionTitle}>Transfer host</h3>
            <label className="sr-only" htmlFor="host-mod-transfer">
              New host
            </label>
            <select
              id="host-mod-transfer"
              className={modStyles.select}
              value={transferUid}
              disabled={busy || transferCandidates.length === 0}
              onChange={(event) => {
                setTransferUid(event.target.value);
                setConfirmTransfer(false);
              }}
            >
              {transferCandidates.length === 0 ? (
                <option value="">No other humans aboard</option>
              ) : (
                transferCandidates.map((captain) => (
                  <option key={captain.id} value={captain.id}>
                    {captain.displayName}
                  </option>
                ))
              )}
            </select>
            <div className={modStyles.iconRow}>
              <button
                type="button"
                className={modStyles.iconBtn}
                disabled={busy || !transferUid}
                aria-expanded={confirmTransfer}
                onClick={() => {
                  setConfirmDissolve(false);
                  setConfirmTransfer(true);
                }}
              >
                Transfer command
              </button>
            </div>
            {confirmTransfer && transferUid ? (
              <div
                className={modStyles.confirmBox}
                role="group"
                aria-label="Confirm transfer host"
              >
                <p className={modStyles.hint}>
                  Hand the bridge to{' '}
                  <strong>
                    {
                      transferCandidates.find((c) => c.id === transferUid)
                        ?.displayName
                    }
                  </strong>
                  ? They will run AI officers and host controls. You stay
                  seated.
                </p>
                <div className={modStyles.iconRow}>
                  <button
                    type="button"
                    className={confirmStyles.cancelBtn}
                    disabled={busy}
                    onClick={() => setConfirmTransfer(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={confirmStyles.confirmBtn}
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        await onTransferHost(transferUid);
                        setConfirmTransfer(false);
                        setStatusMsg('Host transferred.');
                        onClose();
                      })();
                    }}
                  >
                    Transfer
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={modStyles.section} aria-label="Captain actions">
            <h3 className={modStyles.sectionTitle}>Captain</h3>
            <label className="sr-only" htmlFor="host-mod-captain">
              Select captain
            </label>
            <select
              id="host-mod-captain"
              className={modStyles.select}
              value={selectedUid}
              disabled={busy || selectable.length === 0}
              onChange={(event) => {
                setSelectedUid(event.target.value);
                clearCaptainPanels();
              }}
            >
              {selectable.length === 0 ? (
                <option value="">No other captains aboard</option>
              ) : (
                selectable.map((captain) => (
                  <option key={captain.id} value={captain.id}>
                    {captain.displayName}
                    {isAiCaptain(captain) ? ' · AI' : ''}
                  </option>
                ))
              )}
            </select>

            <div className={modStyles.iconRow}>
              {!selectedIsAi ? (
                <>
                  <button
                    type="button"
                    className={modStyles.iconBtn}
                    disabled={busy || !selected}
                    aria-expanded={reportOpen}
                    onClick={() => {
                      clearCaptainPanels();
                      setReportOpen(true);
                    }}
                  >
                    <MaskIcon src="/comment-exclamation-duotone-light-full.svg" />
                    Report
                  </button>
                  <button
                    type="button"
                    className={modStyles.iconBtn}
                    disabled={busy || !selected}
                    aria-expanded={muteOpen}
                    onClick={() => {
                      clearCaptainPanels();
                      setMuteOpen(true);
                    }}
                  >
                    Mute
                  </button>
                  <button
                    type="button"
                    className={modStyles.iconBtn}
                    disabled={busy || !selected}
                    aria-expanded={confirmReplace}
                    onClick={() => {
                      clearCaptainPanels();
                      setConfirmReplace(true);
                    }}
                  >
                    Replace with AI
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className={modStyles.iconBtn}
                data-tone="danger"
                disabled={busy || !selected}
                aria-expanded={confirmDrop}
                onClick={() => {
                  clearCaptainPanels();
                  setConfirmDrop(true);
                }}
              >
                <MaskIcon src="/person-circle-minus-duotone-thin-full.svg" />
                Drop
              </button>
            </div>

            {muteOpen && selected && !selectedIsAi ? (
              <div
                className={modStyles.reportForm}
                role="group"
                aria-label={`Mute ${selected.displayName}`}
              >
                <label className="sr-only" htmlFor="host-mod-mute-reason">
                  Mute reason
                </label>
                <textarea
                  id="host-mod-mute-reason"
                  className={modStyles.reason}
                  value={muteReason}
                  disabled={busy}
                  placeholder={`Why mute ${selected.displayName} in this sector?`}
                  onChange={(event) => setMuteReason(event.target.value)}
                />
                <div className={modStyles.iconRow}>
                  <button
                    type="button"
                    className={confirmStyles.confirmBtn}
                    disabled={busy || !muteReason.trim()}
                    onClick={() => {
                      void (async () => {
                        await onMuteCaptain(selected.id, muteReason.trim());
                        setMuteOpen(false);
                        setMuteReason('');
                        setStatusMsg(
                          `${selected.displayName} muted in this sector.`
                        );
                      })();
                    }}
                  >
                    Mute in sector
                  </button>
                  <button
                    type="button"
                    className={confirmStyles.cancelBtn}
                    disabled={busy}
                    onClick={() => setMuteOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {confirmReplace && selected && !selectedIsAi ? (
              <div
                className={modStyles.confirmBox}
                role="group"
                aria-label={`Replace ${selected.displayName} with AI`}
              >
                <p className={modStyles.hint}>
                  Replace <strong>{selected.displayName}</strong> with an AI
                  officer. Their hand and seat stay in the turn order. Sector
                  becomes unrated.
                </p>
                <label className="sr-only" htmlFor="host-mod-replace-skill">
                  AI skill
                </label>
                <select
                  id="host-mod-replace-skill"
                  className={modStyles.select}
                  value={replaceSkill}
                  disabled={busy}
                  onChange={(event) =>
                    setReplaceSkill(event.target.value as WarpSkillLevel)
                  }
                >
                  {SKILL_OPTIONS.map((skill) => (
                    <option key={skill} value={skill}>
                      {formatAiSkillUnratedLabel(skill)}
                    </option>
                  ))}
                </select>
                <div className={modStyles.iconRow}>
                  <button
                    type="button"
                    className={confirmStyles.cancelBtn}
                    disabled={busy}
                    onClick={() => setConfirmReplace(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={confirmStyles.confirmBtn}
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        await onReplaceWithAi(selected.id, replaceSkill);
                        setConfirmReplace(false);
                        setStatusMsg(
                          `${selected.displayName} replaced with AI.`
                        );
                      })();
                    }}
                  >
                    Replace seat
                  </button>
                </div>
              </div>
            ) : null}

            {reportOpen && selected && !selectedIsAi ? (
              <div
                className={modStyles.reportForm}
                role="group"
                aria-label={`Report ${selected.displayName}`}
              >
                <label className="sr-only" htmlFor="host-mod-report-category">
                  Report category
                </label>
                <select
                  id="host-mod-report-category"
                  className={modStyles.select}
                  value={reportCategory}
                  disabled={reporting}
                  onChange={(event) =>
                    setReportCategory(
                      event.target.value as PlayerReportCategory
                    )
                  }
                >
                  {REPORT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="host-mod-report-reason">
                  Report reason
                </label>
                <textarea
                  id="host-mod-report-reason"
                  className={modStyles.reason}
                  value={reportReason}
                  disabled={reporting}
                  placeholder={`Why are you reporting ${selected.displayName}?`}
                  onChange={(event) => setReportReason(event.target.value)}
                />
                <div className={modStyles.iconRow}>
                  <button
                    type="button"
                    className={confirmStyles.confirmBtn}
                    disabled={reporting || !reportReason.trim()}
                    onClick={() => {
                      void (async () => {
                        setReporting(true);
                        try {
                          const result = await onReportCaptain({
                            targetUid: selected.id,
                            category: reportCategory,
                            reason: reportReason.trim(),
                          });
                          const msg = result.alreadySubmitted
                            ? 'You already reported this captain.'
                            : `${selected.displayName} reported to Warp moderators.`;
                          setStatusMsg(msg);
                          setReportOpen(false);
                          setReportReason('');
                        } catch {
                          setStatusMsg(
                            'Could not submit the report. Try again later.',
                            'assertive'
                          );
                        } finally {
                          setReporting(false);
                        }
                      })();
                    }}
                  >
                    Submit report
                  </button>
                  <button
                    type="button"
                    className={confirmStyles.cancelBtn}
                    disabled={reporting}
                    onClick={() => setReportOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {confirmDrop && selected ? (
              <div
                className={modStyles.confirmBox}
                role="group"
                aria-label={`Confirm drop ${selected.displayName}`}
              >
                <p className={modStyles.hint}>
                  Drop <strong>{selected.displayName}</strong> from this
                  sector? Their seat is removed
                  {selectedIsAi
                    ? '.'
                    : ' (use Replace with AI to keep the seat filled).'}
                </p>
                <div className={modStyles.iconRow}>
                  <button
                    type="button"
                    className={confirmStyles.cancelBtn}
                    disabled={busy}
                    onClick={() => setConfirmDrop(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={confirmStyles.confirmBtn}
                    data-tone="danger"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        await onDropCaptain(selected.id);
                        setConfirmDrop(false);
                      })();
                    }}
                  >
                    Drop seat
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={modStyles.section} aria-label="Spectator link">
            <h3 className={modStyles.sectionTitle}>Spectator link</h3>
            <div className={modStyles.iconRow}>
              <button
                type="button"
                className={modStyles.iconBtn}
                disabled={!allowSpectate}
                aria-label={
                  allowSpectate
                    ? 'Copy spectator link'
                    : 'Copy spectator link (gallery closed)'
                }
                onClick={() => {
                  const { watchUrl } = sectorInviteLinks(sectorCode);
                  void copyTextToClipboard(watchUrl)
                    .then(() => setStatusMsg('Spectator link copied.'))
                    .catch(() =>
                      setStatusMsg(
                        'Could not copy spectator link.',
                        'assertive'
                      )
                    );
                }}
              >
                <MaskIcon
                  src={
                    allowSpectate
                      ? '/eye-duotone-thin-full.svg'
                      : '/eye-slash-sharp-duotone-solid-full.svg'
                  }
                />
                Copy spectator link
              </button>
            </div>
          </section>

          {status ? (
            <p className={modStyles.status} role="status">
              {status}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
