import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SubspaceMessage } from '../firebase/messages.js';
import { sendQuickPhrase, sendTextMessage } from '../firebase/messages.js';
import { quickCommPhraseById, type QuickCommPhrase } from '../game/quick-comms.js';
import { createMessageRateLimiter } from '../game/message-rate-limit.js';
import type { CommsMode } from '../game/comms-mode.js';
import { QuickCommsWheel } from './quick-comms-wheel.js';
import styles from './comms-panel.module.scss';

export interface CommsPanelProps {
  gameId: string;
  viewerUid: string;
  viewerName: string;
  messages: readonly SubspaceMessage[];
  mode: CommsMode;
  captains: readonly { id: string; displayName: string }[];
  /** Muted captain uids — their messages are hidden. */
  muted?: ReadonlySet<string>;
  onMute?: (uid: string) => void;
}

export function CommsPanel({
  gameId,
  viewerUid,
  viewerName,
  messages,
  mode,
  captains,
  muted = new Set(),
  onMute,
}: CommsPanelProps) {
  const [textInput, setTextInput] = useState('');
  const [dmTarget, setDmTarget] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [throttled, setThrottled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rateLimiter = useMemo(() => createMessageRateLimiter(), []);

  const visibleMessages = messages.filter((msg) => !muted.has(msg.from));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [visibleMessages.length]);

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
    if (!rateLimiter.trySend()) {
      setThrottled(true);
      setTimeout(() => setThrottled(false), rateLimiter.cooldownRemaining() * 1000);
      return;
    }
    setSending(true);
    try {
      await sendTextMessage(gameId, viewerUid, viewerName, trimmed, dmTarget);
      setTextInput('');
    } finally {
      setSending(false);
    }
  }, [gameId, viewerUid, viewerName, textInput, dmTarget, sending, rateLimiter]);

  return (
    <section className={styles.panel} aria-label="Subspace comms">
      <div ref={scrollRef} className={styles.log}>
        {visibleMessages.length === 0 && (
          <p className={styles.empty}>No subspace transmissions yet.</p>
        )}
        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
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
            {msg.from !== viewerUid && onMute && (
              <button
                type="button"
                className={styles.muteBtn}
                title={`Mute ${msg.fromName}`}
                onClick={() => onMute(msg.from)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <QuickCommsWheel onSend={handleSendPhrase} disabled={sending || throttled} />

      {throttled && (
        <p className={styles.restriction}>
          Slow down, Captain — wait a moment before your next transmission.
        </p>
      )}

      {mode === 'full' && (
        <div className={styles.composer}>
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
          <input
            className={styles.textInput}
            type="text"
            maxLength={200}
            placeholder="Open hailing frequencies…"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSendText();
              }
            }}
            disabled={sending}
          />
          <button
            type="button"
            className={styles.sendBtn}
            disabled={!textInput.trim() || sending}
            onClick={() => void handleSendText()}
          >
            Transmit
          </button>
        </div>
      )}

      {mode === 'quick-only' && (
        <p className={styles.restriction}>
          Rated sector — comms restricted to quick hails during active play.
        </p>
      )}
    </section>
  );
}
