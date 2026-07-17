import { useEffect, useState } from 'react';

import {
  getContentReviewConfig,
  getModerationEvidencePack,
  listModerationReports,
  updateContentReviewConfig,
  updateModerationReport,
  type ContentReviewConfig,
  type ModerationReport,
  type ReportStatus,
} from '../firebase/reports-service';
import { deleteSectorMessage } from '../firebase/messages-service';
import { muteUser } from '../firebase/moderation-service';
import { useOpsAuth } from '../firebase/ops-auth';

function fmtWhen(iso: string): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function linesToList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values: string[]): string {
  return values.join('\n');
}

function evidencePreview(report: ModerationReport): string {
  const evidence = report.evidence ?? {};
  const message = evidence.message as
    | { text?: string | null; fromName?: string; phraseId?: string | null }
    | undefined;
  if (message) {
    return (
      message.text?.trim() ||
      message.phraseId ||
      `${message.fromName ?? 'message'}`
    );
  }
  const captain = evidence.captain as
    | { displayName?: string; uid?: string }
    | undefined;
  if (captain) {
    return captain.displayName || captain.uid || 'captain';
  }
  if (Array.isArray(evidence.relatedUids)) {
    return `related: ${(evidence.relatedUids as string[]).length} uid(s)`;
  }
  if (Array.isArray(evidence.cohortUids)) {
    return `cohort: ${(evidence.cohortUids as string[]).length} uid(s)`;
  }
  return report.reason;
}

export function ReportsPanel() {
  const { isAdmin } = useOpsAuth();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>(
    'open'
  );
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [selected, setSelected] = useState<ModerationReport | null>(null);
  const [note, setNote] = useState('');
  const [config, setConfig] = useState<ContentReviewConfig | null>(null);
  const [chatTerms, setChatTerms] = useState('');
  const [nameTerms, setNameTerms] = useState('');
  const [allowlist, setAllowlist] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [packJson, setPackJson] = useState<string | null>(null);

  const refreshReports = async (filter: ReportStatus | 'all' = statusFilter) => {
    setBusy(true);
    setError(null);
    try {
      const res = await listModerationReports(filter, 100, {
        source: sourceFilter === 'all' ? 'all' : sourceFilter,
      });
      setReports(res.reports);
      setStatus(`Loaded ${res.reports.length} report(s).`);
      if (selected) {
        setSelected(
          res.reports.find((r) => r.reportId === selected.reportId) ?? null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.');
    } finally {
      setBusy(false);
    }
  };

  const refreshConfig = async () => {
    try {
      const res = await getContentReviewConfig();
      setConfig(res.config);
      setChatTerms(listToLines(res.config.chatTerms));
      setNameTerms(listToLines(res.config.displayNameTerms));
      setAllowlist(listToLines(res.config.allowlist));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load review lists.'
      );
    }
  };

  useEffect(() => {
    void refreshReports('open');
    if (isAdmin) {
      void refreshConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const onResolve = async (next: ReportStatus) => {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateModerationReport({
        reportId: selected.reportId,
        status: next,
        resolutionNote: note.trim() || undefined,
      });
      setNote('');
      setStatus(`Report ${selected.reportId} → ${next}.`);
      await refreshReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
      setBusy(false);
    }
  };

  const onSaveLists = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await updateContentReviewConfig({
        chatTerms: linesToList(chatTerms),
        displayNameTerms: linesToList(nameTerms),
        allowlist: linesToList(allowlist),
      });
      setConfig(res.config);
      setChatTerms(listToLines(res.config.chatTerms));
      setNameTerms(listToLines(res.config.displayNameTerms));
      setAllowlist(listToLines(res.config.allowlist));
      setStatus('Review lists saved (review-only; no auto-ban).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save lists.');
    } finally {
      setBusy(false);
    }
  };

  const onMuteTarget = async (mode: 'hard' | 'shadow' = 'hard') => {
    if (!selected?.targetUid) {
      return;
    }
    const label = mode === 'shadow' ? 'Shadow-mute' : 'Mute';
    const reason =
      window.prompt(
        `${label} ${selected.targetUid}? Reason:`,
        selected.reason || 'Report queue'
      ) ?? '';
    if (!reason.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await muteUser({
        uid: selected.targetUid,
        reason: reason.trim(),
        mode,
      });
      setStatus(`${label} applied to ${selected.targetUid}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mute failed.');
    } finally {
      setBusy(false);
    }
  };

  const onEvidencePack = async () => {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await getModerationEvidencePack({
        reportId: selected.reportId,
        gameId: selected.gameId ?? undefined,
        targetUid: selected.targetUid ?? undefined,
      });
      setPackJson(JSON.stringify(res.pack, null, 2));
      setStatus('Evidence pack ready (download/copy below).');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not build evidence pack.'
      );
    } finally {
      setBusy(false);
    }
  };

  const onDeleteMessage = async () => {
    if (!selected?.gameId || !selected.messageId) {
      return;
    }
    const reason =
      window.prompt('Delete message? Optional audit reason:', selected.reason) ??
      null;
    if (reason === null) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteSectorMessage(
        selected.gameId,
        selected.messageId,
        reason.trim() || undefined
      );
      setStatus(`Deleted message ${selected.messageId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="reports-title">
        <h2 id="reports-title">Report inbox</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Player reports, review-term flags, and system integrity detectors
          (related-IP, rematch cohort, escalate). Detectors never ban or mute —
          they only open queue items for human review.
        </p>
        <div className="grid two">
          <label>
            Status filter
            <select
              value={statusFilter}
              onChange={(e) => {
                const next = e.target.value as ReportStatus | 'all';
                setStatusFilter(next);
                void refreshReports(next);
              }}
            >
              <option value="open">open</option>
              <option value="reviewing">reviewing</option>
              <option value="resolved">resolved</option>
              <option value="dismissed">dismissed</option>
              <option value="all">all</option>
            </select>
          </label>
          <label>
            Source filter
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">all sources</option>
              <option value="player">player</option>
              <option value="auto">auto (review terms)</option>
              <option value="system">system (integrity)</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void refreshReports()}
          >
            Refresh
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Source</th>
                <th scope="col">Category</th>
                <th scope="col">Subject</th>
                <th scope="col">Target</th>
                <th scope="col">Preview</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={7}>No reports in this filter.</td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.reportId}>
                    <td>{fmtWhen(report.createdAt)}</td>
                    <td>
                      <span className="badge">{report.source}</span>
                    </td>
                    <td>{report.category}</td>
                    <td>{report.subjectType}</td>
                    <td className="mono">
                      {(report.targetUid ?? '—').slice(0, 12)}
                      {(report.targetUid?.length ?? 0) > 12 ? '…' : ''}
                    </td>
                    <td>{evidencePreview(report)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        aria-label={`Open report ${report.reportId}`}
                        onClick={() => setSelected(report)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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

      {selected ? (
        <section className="panel" aria-labelledby="report-detail-title">
          <h2 id="report-detail-title">Report detail</h2>
          <p className="mono" style={{ marginTop: 0 }}>
            {selected.reportId}
          </p>
          <p>
            <span className="badge">{selected.status}</span>{' '}
            <span className="badge">{selected.source}</span>{' '}
            <span className="badge">{selected.category}</span>
            {selected.detector ? (
              <>
                {' '}
                <span className="badge">{selected.detector}</span>
              </>
            ) : null}
            {selected.priority === 'elevated' ? (
              <>
                {' '}
                <span className="badge">elevated</span>
              </>
            ) : null}
          </p>
          <p style={{ color: 'var(--muted)' }}>
            Sector {selected.gameId ?? '—'} · message {selected.messageId ?? '—'}{' '}
            · target {selected.targetUid ?? '—'} · reporter{' '}
            {selected.reporterUid ?? 'auto'}
          </p>
          <p>{selected.reason}</p>
          {selected.matchedTerms?.length ? (
            <p>
              Matched terms:{' '}
              <code>{selected.matchedTerms.join(', ')}</code>
            </p>
          ) : null}
          <pre
            className="mono"
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.72rem',
              maxHeight: '14rem',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(selected.evidence ?? {}, null, 2)}
          </pre>
          <label>
            Resolution note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for audit"
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onResolve('reviewing')}
            >
              Mark reviewing
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void onResolve('resolved')}
            >
              Resolve
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onResolve('dismissed')}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onEvidencePack()}
            >
              Evidence pack
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !selected.targetUid}
              onClick={() => void onMuteTarget('hard')}
            >
              Mute target
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !selected.targetUid}
              onClick={() => void onMuteTarget('shadow')}
            >
              Shadow-mute
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={busy || !selected.gameId || !selected.messageId}
              onClick={() => void onDeleteMessage()}
            >
              Delete message
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSelected(null);
                setPackJson(null);
              }}
            >
              Close
            </button>
          </div>
          {packJson ? (
            <pre
              className="mono"
              style={{
                marginTop: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '0.72rem',
                maxHeight: '18rem',
                overflow: 'auto',
              }}
            >
              {packJson}
            </pre>
          ) : null}
        </section>
      ) : null}

      {isAdmin ? (
      <section className="panel" aria-labelledby="review-lists-title">
        <h2 id="review-lists-title">Review term lists</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Token / word-boundary matching only (e.g. <code>ass</code> will not
          hit Cassandra). One term per line. Hits create open reports — they do
          not mute, ban, or block send.
        </p>
        <div className="grid two">
          <label>
            Chat terms
            <textarea
              value={chatTerms}
              onChange={(e) => setChatTerms(e.target.value)}
              placeholder="one term per line"
            />
          </label>
          <label>
            Display-name terms
            <textarea
              value={nameTerms}
              onChange={(e) => setNameTerms(e.target.value)}
              placeholder="stricter name list"
            />
          </label>
          <label>
            Allowlist
            <textarea
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              placeholder="false-positive callsigns / phrases"
            />
          </label>
        </div>
        {config?.updatedAt ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Last updated {fmtWhen(config.updatedAt)}
            {config.updatedBy ? ` · ${config.updatedBy}` : ''}
          </p>
        ) : null}
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void onSaveLists()}
          >
            Save lists
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void refreshConfig()}
          >
            Reload
          </button>
        </div>
      </section>
      ) : null}
    </>
  );
}
