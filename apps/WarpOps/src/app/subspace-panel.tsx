import { useState } from 'react';

import {
  deleteSectorMessage,
  listSectorMessages,
  redactSectorMessage,
  searchMessages,
  type OpsMessageHit,
} from '../firebase/messages-service';
import { muteInSector, muteUser } from '../firebase/moderation-service';

function fmtWhen(iso: string): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function toDayStartIso(dateStr: string): string | undefined {
  if (!dateStr.trim()) {
    return undefined;
  }
  return `${dateStr.trim()}T00:00:00.000Z`;
}

function toDayEndIso(dateStr: string): string | undefined {
  if (!dateStr.trim()) {
    return undefined;
  }
  return `${dateStr.trim()}T23:59:59.999Z`;
}

function preview(hit: OpsMessageHit): string {
  if (hit.kind === 'phrase') {
    return hit.text?.trim() || hit.phraseId || '(phrase)';
  }
  return hit.text?.trim() || '(empty)';
}

function MessageTable({
  hits,
  busy,
  onOpenThread,
  onDelete,
  onRedact,
  onMuteGlobal,
  onMuteSector,
}: {
  hits: OpsMessageHit[];
  busy: boolean;
  onOpenThread: (gameId: string) => void;
  onDelete: (hit: OpsMessageHit) => void;
  onRedact: (hit: OpsMessageHit) => void;
  onMuteGlobal: (hit: OpsMessageHit) => void;
  onMuteSector: (hit: OpsMessageHit) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Sector</th>
            <th scope="col">From</th>
            <th scope="col">Channel</th>
            <th scope="col">Message</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hits.length === 0 ? (
            <tr>
              <td colSpan={6}>No messages.</td>
            </tr>
          ) : (
            hits.map((h) => (
              <tr key={`${h.gameId}:${h.messageId}`}>
                <td>{fmtWhen(h.at)}</td>
                <td className="mono">{h.gameId}</td>
                <td>
                  {h.fromName || '—'}
                  <div className="mono" style={{ color: 'var(--muted)' }}>
                    {h.from.slice(0, 12)}
                    {h.from.length > 12 ? '…' : ''}
                  </div>
                </td>
                <td>
                  <span className="badge">{h.channel}</span>
                  {h.to ? (
                    <>
                      {' '}
                      <span className="badge anon">DM</span>
                    </>
                  ) : null}
                  {' '}
                  <span className="badge">{h.kind}</span>
                </td>
                <td>{preview(h)}</td>
                <td>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      aria-label={`Open thread for sector ${h.gameId}`}
                      onClick={() => onOpenThread(h.gameId)}
                    >
                      Thread
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busy}
                      aria-label={`Delete message ${h.messageId}`}
                      onClick={() => onDelete(h)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      aria-label={`Redact message ${h.messageId}`}
                      onClick={() => onRedact(h)}
                    >
                      Redact
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !h.from}
                      aria-label={`Globally mute ${h.fromName || h.from}`}
                      onClick={() => onMuteGlobal(h)}
                    >
                      Mute
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !h.from}
                      aria-label={`Mute ${h.fromName || h.from} in this sector`}
                      onClick={() => onMuteSector(h)}
                    >
                      Mute in sector
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SubspacePanel() {
  const [text, setText] = useState('');
  const [fromUid, setFromUid] = useState('');
  const [fromName, setFromName] = useState('');
  const [gameId, setGameId] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [hits, setHits] = useState<OpsMessageHit[]>([]);
  const [thread, setThread] = useState<OpsMessageHit[] | null>(null);
  const [threadGameId, setThreadGameId] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSearch = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    setThread(null);
    setThreadGameId(null);
    try {
      const res = await searchMessages({
        text: text.trim() || undefined,
        fromUid: fromUid.trim() || undefined,
        fromName: fromName.trim() || undefined,
        gameId: gameId.trim() || undefined,
        fromIso: toDayStartIso(fromDate),
        toIso: toDayEndIso(toDate),
        limit: 50,
      });
      setHits(res.hits);
      setScanNote(res.note);
      setStatus(
        `Found ${res.hits.length} hit(s) (scanned ${res.scanned} in window).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const onOpenThread = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await listSectorMessages(id, 300);
      setThread(res.messages);
      setThreadGameId(res.gameId);
      setStatus(`Loaded ${res.messages.length} message(s) in sector ${id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load thread.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (hit: OpsMessageHit) => {
    const reason = window.prompt(
      `Delete message in ${hit.gameId}? Optional reason for audit:`,
      ''
    );
    if (reason === null) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteSectorMessage(
        hit.gameId,
        hit.messageId,
        reason.trim() || undefined
      );
      setHits((prev) =>
        prev.filter(
          (h) => !(h.gameId === hit.gameId && h.messageId === hit.messageId)
        )
      );
      setThread((prev) =>
        prev ? prev.filter((h) => h.messageId !== hit.messageId) : prev
      );
      setStatus(`Deleted message ${hit.messageId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const onRedact = async (hit: OpsMessageHit) => {
    const reason = window.prompt(
      `Redact message in ${hit.gameId}? Keeps the doc; blanks the body. Reason:`,
      ''
    );
    if (reason === null) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await redactSectorMessage(
        hit.gameId,
        hit.messageId,
        reason.trim() || undefined
      );
      const patch = (h: OpsMessageHit): OpsMessageHit =>
        h.gameId === hit.gameId && h.messageId === hit.messageId
          ? { ...h, text: '[transmission redacted by Ops]', kind: 'text', phraseId: null }
          : h;
      setHits((prev) => prev.map(patch));
      setThread((prev) => (prev ? prev.map(patch) : prev));
      setStatus(`Redacted message ${hit.messageId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redact failed.');
    } finally {
      setBusy(false);
    }
  };

  const onMuteGlobal = async (hit: OpsMessageHit) => {
    const reason = window.prompt(
      `Globally mute ${hit.fromName || hit.from}? Reason:`,
      'Subspace abuse'
    );
    if (reason === null || !reason.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await muteUser({ uid: hit.from, reason: reason.trim() });
      setStatus(`Muted ${hit.from} globally.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mute failed.');
    } finally {
      setBusy(false);
    }
  };

  const onMuteSector = async (hit: OpsMessageHit) => {
    const reason = window.prompt(
      `Mute ${hit.fromName || hit.from} in sector ${hit.gameId}? Reason:`,
      'Subspace abuse'
    );
    if (reason === null || !reason.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await muteInSector({
        gameId: hit.gameId,
        uid: hit.from,
        reason: reason.trim(),
      });
      setStatus(`Muted ${hit.from} in ${hit.gameId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sector mute failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="subspace-search-heading">
        <h2 id="subspace-search-heading">Subspace search</h2>
        <p style={{ color: 'var(--muted)', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
          Default window is the last 7 days. Text and display-name filters run
          in memory over the date/sender-bounded scan (not full-text index).
        </p>
        <div className="grid two">
          <label>
            Text contains
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="substring…"
              autoComplete="off"
            />
          </label>
          <label>
            Sector id
            <input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="optional"
              className="mono"
              autoComplete="off"
            />
          </label>
          <label>
            Sender uid
            <input
              value={fromUid}
              onChange={(e) => setFromUid(e.target.value)}
              placeholder="optional"
              className="mono"
              autoComplete="off"
            />
          </label>
          <label>
            Sender name contains
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="optional"
              autoComplete="off"
            />
          </label>
          <label>
            From date
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void onSearch()}
          >
            Search
          </button>
          {gameId.trim() ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onOpenThread(gameId.trim())}
            >
              Load sector thread
            </button>
          ) : null}
        </div>
        {error ? (
          <div className="msg error" role="alert">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="msg ok" role="status">
            {status}
          </div>
        ) : null}
        {scanNote ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{scanNote}</p>
        ) : null}
        <MessageTable
          hits={hits}
          busy={busy}
          onOpenThread={(id) => void onOpenThread(id)}
          onDelete={(h) => void onDelete(h)}
          onRedact={(h) => void onRedact(h)}
          onMuteGlobal={(h) => void onMuteGlobal(h)}
          onMuteSector={(h) => void onMuteSector(h)}
        />
      </section>

      {thread && threadGameId ? (
        <section className="panel" aria-labelledby="subspace-thread-heading">
          <h2 id="subspace-thread-heading">
            Sector thread · <code className="mono">{threadGameId}</code>
          </h2>
          <MessageTable
            hits={thread}
            busy={busy}
            onOpenThread={() => undefined}
            onDelete={(h) => void onDelete(h)}
            onRedact={(h) => void onRedact(h)}
            onMuteGlobal={(h) => void onMuteGlobal(h)}
            onMuteSector={(h) => void onMuteSector(h)}
          />
        </section>
      ) : null}
    </>
  );
}
