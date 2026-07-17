import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SubspaceMessage } from '../firebase/messages.js';
import { sendQuickPhrase, sendTextMessage } from '../firebase/messages.js';
import {
  reportSectorMessage,
  type PlayerReportCategory,
} from '../firebase/moderation-reports.js';
import { copyTextToClipboard } from '../game/deliver-file.js';
import { quickCommPhraseById, type QuickCommPhrase } from '../game/quick-comms.js';
import { createMessageRateLimiter } from '../game/message-rate-limit.js';
import { runSlashCommand } from '../game/slash-commands.js';
import { useAnnounce } from '../a11y/live-announcer.js';
import {
  resolveCommsMode,
  type CommsChannel,
} from '../game/comms-mode.js';
import { QuickCommsWheel } from './quick-comms-wheel.js';
import styles from './comms-panel.module.scss';

export interface CommsPanelProps {
  gameId: string;
  viewerUid: string;
  viewerName: string;
  messages: readonly SubspaceMessage[];
  /** Sector rated + phase — the panel resolves table vs squad mode per active tab. */
  rated: boolean;
  phase: 'lobby' | 'active' | 'complete' | 'round-end';
  captains: readonly { id: string; displayName: string }[];
  /** Module Zeta: the viewer's own squadron, when squads are enabled. Omit for FFA sectors. */
  viewerSquadronId?: string;
  /** Module Zeta: the viewer's squad display name (host-chosen or "Squad N"). */
  viewerSquadronName?: string;
  /** Muted captain uids — their messages are hidden. */
  muted?: ReadonlySet<string>;
  onMute?: (uid: string) => void;
  /** Spectators / supervisors: view only, no send. */
  readOnly?: boolean;
  /** Host allowSpectate flag — used by /spectate local command. Default true. */
  allowSpectate?: boolean;
}

export function CommsPanel({
  gameId,
  viewerUid,
  viewerName,
  messages,
  rated,
  phase,
  captains,
  viewerSquadronId,
  viewerSquadronName,
  muted = new Set(),
  onMute,
  readOnly = false,
  allowSpectate = true,
}: CommsPanelProps) {
  const [textInput, setTextInput] = useState('');
  const [dmTarget, setDmTarget] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [throttled, setThrottled] = useState(false);
  const [activeChannel, setActiveChannel] = useState<CommsChannel>('table');
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [reportCategory, setReportCategory] =
    useState<PlayerReportCategory>('harassment');
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [localReply, setLocalReply] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rateLimiter = useMemo(() => createMessageRateLimiter(), []);
  const announce = useAnnounce();

  const hasSquad = Boolean(viewerSquadronId);
  // Never let a squad-less viewer (or a squad-less sector) get stuck on the
  // squad tab — collapse back to table.
  const channel: CommsChannel = hasSquad ? activeChannel : 'table';
  const enginePhase = phase === 'round-end' ? 'active' : phase;
  const mode = resolveCommsMode(rated, enginePhase, channel);
  const showComposer = mode === 'full' || textInput.trimStart().startsWith('/');

  const channelMessages = messages.filter((msg) => {
    if (msg.shadowHidden === true && msg.from !== viewerUid) {
      return false;
    }
    return channel === 'squad'
      ? msg.channel === 'squad' && msg.squadronId === viewerSquadronId
      : (msg.channel ?? 'table') !== 'squad';
  });
  const visibleMessages = channelMessages.filter((msg) => !muted.has(msg.from));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [visibleMessages.length, localReply]);

  const handleSendPhrase = useCallback(
    (phrase: QuickCommPhrase) => {
      if (!rateLimiter.trySend()) {
        setThrottled(true);
        setTimeout(() => setThrottled(false), rateLimiter.cooldownRemaining() * 1000);
        return;
      }
      void sendQuickPhrase(gameId, viewerUid, viewerName, phrase.id);
    },
    [gameId, viewerUid, viewerName, rateLimiter]
  );

  const handleSendText = useCallback(async () => {
    const trimmed = textInput.trim();
    if (!trimmed || sending) {
      return;
    }

    const slash = runSlashCommand(trimmed, { gameId, allowSpectate });
    if (slash) {
      setTextInput('');
      setLocalReply(slash.text);
      announce(slash.text, slash.kind === 'error' ? 'assertive' : 'polite');
      if (slash.kind === 'reply' && slash.copyText) {
        try {
          await copyTextToClipboard(slash.copyText);
          announce('Spectator link copied to clipboard.', 'polite');
        } catch {
          // Clipboard can fail in some webviews; the reply still shows the URL.
        }
      }
      return;
    }

    if (mode !== 'full') {
      announce(
        'Rated sector — free text is restricted. Use quick hails, or /help for local commands.',
        'assertive'
      );
      return;
    }

    if (!rateLimiter.trySend()) {
      setThrottled(true);
      setTimeout(() => setThrottled(false), rateLimiter.cooldownRemaining() * 1000);
      return;
    }
    setSending(true);
    try {
      await sendTextMessage(
        gameId,
        viewerUid,
        viewerName,
        trimmed,
        channel === 'squad' ? undefined : dmTarget,
        channel === 'squad' && viewerSquadronId
          ? { channel: 'squad', squadronId: viewerSquadronId }
          : undefined
      );
      setTextInput('');
      setLocalReply(null);
    } finally {
      setSending(false);
    }
  }, [
    allowSpectate,
    announce,
    channel,
    dmTarget,
    gameId,
    mode,
    rateLimiter,
    sending,
    textInput,
    viewerName,
    viewerSquadronId,
    viewerUid,
  ]);

  const handleReport = useCallback(async () => {
    if (!reportMessageId || !reportReason.trim() || reporting) {
      return;
    }
    setReporting(true);
    try {
      const result = await reportSectorMessage({
        gameId,
        messageId: reportMessageId,
        category: reportCategory,
        reason: reportReason.trim(),
      });
      announce(
        result.alreadySubmitted
          ? 'You already reported this transmission.'
          : 'Transmission reported to Warp moderators.',
        'polite'
      );
      setReportMessageId(null);
      setReportReason('');
    } catch {
      announce('Could not submit the report. Try again later.', 'assertive');
    } finally {
      setReporting(false);
    }
  }, [
    announce,
    gameId,
    reportCategory,
    reportMessageId,
    reportReason,
    reporting,
  ]);

  return (
    <section className={styles.panel} aria-label="Subspace comms">
      {hasSquad && (
        <div className={styles.channelTabs} role="tablist" aria-label="Comms channel">
          <button
            type="button"
            role="tab"
            aria-selected={channel === 'table'}
            className={`${styles.channelTab} ${styles.channelTabTable} ${
              channel === 'table' ? styles.channelTabActive : ''
            }`}
            onClick={() => setActiveChannel('table')}
          >
            Table
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={channel === 'squad'}
            className={`${styles.channelTab} ${styles.channelTabSquad} ${
              channel === 'squad' ? styles.channelTabActive : ''
            }`}
            onClick={() => setActiveChannel('squad')}
          >
            {viewerSquadronName ?? 'Squad'}
          </button>
        </div>
      )}
      <div ref={scrollRef} className={styles.log}>
        {visibleMessages.length === 0 && !localReply && (
          <p className={styles.empty}>No subspace transmissions yet.</p>
        )}
        {visibleMessages.map((msg) => (
          <div key={msg.id} className={styles.messageRow}>
            <div
              className={`${styles.msg} ${
                msg.from === viewerUid ? styles.own : ''
              } ${msg.to ? styles.dm : ''}`}
            >
              <span className={styles.sender}>
                {msg.from === viewerUid ? 'You' : msg.fromName}
                {msg.to ? ' → DM' : ''}
              </span>
              <span className={styles.body}>
                {msg.kind === 'phrase'
                  ? quickCommPhraseById(msg.phraseId ?? '')?.text ?? msg.phraseId
                  : msg.text}
              </span>
              {msg.from !== viewerUid && !readOnly ? (
                <span className={styles.messageActions}>
                  {onMute ? (
                    <button
                      type="button"
                      className={styles.messageActionBtn}
                      aria-label={`Mute ${msg.fromName}`}
                      onClick={() => onMute(msg.from)}
                    >
                      Mute
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.messageActionBtn}
                    aria-expanded={reportMessageId === msg.id}
                    aria-controls={`report-${msg.id}`}
                    onClick={() => {
                      setReportMessageId((current) =>
                        current === msg.id ? null : msg.id
                      );
                      setReportReason('');
                    }}
                  >
                    Report
                  </button>
                </span>
              ) : null}
            </div>
            {reportMessageId === msg.id ? (
              <div
                id={`report-${msg.id}`}
                className={styles.reportForm}
                aria-label={`Report transmission from ${msg.fromName}`}
              >
                <label>
                  Category
                  <select
                    value={reportCategory}
                    onChange={(event) =>
                      setReportCategory(
                        event.target.value as PlayerReportCategory
                      )
                    }
                  >
                    <option value="harassment">Harassment</option>
                    <option value="spam">Spam</option>
                    <option value="cheating">Cheating</option>
                    <option value="inappropriate-name">
                      Inappropriate name
                    </option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  What happened?
                  <textarea
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    maxLength={1000}
                    rows={2}
                  />
                </label>
                <div className={styles.reportActions}>
                  <button
                    type="button"
                    className={styles.sendBtn}
                    disabled={reporting || !reportReason.trim()}
                    onClick={() => void handleReport()}
                  >
                    Submit report
                  </button>
                  <button
                    type="button"
                    className={styles.messageActionBtn}
                    disabled={reporting}
                    onClick={() => setReportMessageId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {localReply ? (
          <p className={styles.localReply} role="status">
            {localReply}
          </p>
        ) : null}
      </div>

      {readOnly ? (
        <p className={styles.restriction} role="status">
          Spectating — subspace transmit disabled.
        </p>
      ) : (
        <>
          <QuickCommsWheel
            onSend={handleSendPhrase}
            disabled={sending || throttled}
          />

          {throttled && (
            <p className={styles.restriction}>
              Slow down, Captain — wait a moment before your next transmission.
            </p>
          )}

          {showComposer && (
            <div className={styles.composer}>
              {mode === 'full' ? (
                <select
                  className={styles.dmPicker}
                  aria-label="Message recipient"
                  value={dmTarget ?? ''}
                  onChange={(e) => setDmTarget(e.target.value || undefined)}
                >
                  <option value="">All captains</option>
                  {captains
                    .filter((c) => c.id !== viewerUid)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        DM: {c.displayName}
                      </option>
                    ))}
                </select>
              ) : null}
              <input
                className={styles.textInput}
                type="text"
                maxLength={200}
                placeholder={
                  mode === 'full'
                    ? 'Open hailing frequencies… (/help for commands)'
                    : 'Local command (/spectate, /help)…'
                }
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSendText();
                  }
                }}
                disabled={sending}
                aria-label={
                  mode === 'full'
                    ? 'Subspace message or local command'
                    : 'Local Subspace command'
                }
              />
              <button
                type="button"
                className={styles.sendBtn}
                disabled={!textInput.trim() || sending}
                onClick={() => void handleSendText()}
              >
                {textInput.trimStart().startsWith('/') ? 'Run' : 'Transmit'}
              </button>
            </div>
          )}

          {mode === 'quick-only' && !showComposer && (
            <p className={styles.restriction}>
              Rated sector — quick hails only. Type{' '}
              <button
                type="button"
                className={styles.inlineCommandHint}
                onClick={() => setTextInput('/')}
              >
                /
              </button>{' '}
              for local commands (e.g. /spectate).
            </p>
          )}
        </>
      )}
    </section>
  );
}
