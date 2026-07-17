import { useState } from 'react';

import { listOpsAudit, type OpsAuditEntry } from '../firebase/audit-service';

function fmtWhen(iso: string): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function AuditPanel() {
  const [action, setAction] = useState('');
  const [actorUid, setActorUid] = useState('');
  const [targetUid, setTargetUid] = useState('');
  const [entries, setEntries] = useState<OpsAuditEntry[]>([]);
  const [selected, setSelected] = useState<OpsAuditEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onLoad = async () => {
    setBusy(true);
    setError(null);
    try {
      // Prefer one filter at a time (matches server query).
      const res = await listOpsAudit({
        action: action.trim() || undefined,
        actorUid: !action.trim() && actorUid.trim() ? actorUid.trim() : undefined,
        targetUid:
          !action.trim() && !actorUid.trim() && targetUid.trim()
            ? targetUid.trim()
            : undefined,
        limit: 150,
      });
      setEntries(res.entries);
      setSelected(null);
      setStatus(`Loaded ${res.entries.length} audit entr${res.entries.length === 1 ? 'y' : 'ies'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit load failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="audit-filters-title">
        <h2 id="audit-filters-title">Audit log</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Append-only ops actions. Use one filter at a time (action wins over
          actor, actor over target). Empty filters load the latest entries.
        </p>
        <div className="grid two">
          <label>
            Action
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. mute_user, ops_kick"
              list="audit-actions"
            />
            <datalist id="audit-actions">
              <option value="mute_user" />
              <option value="unmute_user" />
              <option value="ops_kick" />
              <option value="ops_terminate" />
              <option value="message_delete" />
              <option value="moderation_report_update" />
              <option value="ban_user" />
              <option value="unban_user" />
              <option value="display_name_set" />
              <option value="roles_set" />
            </datalist>
          </label>
          <label>
            Actor uid
            <input
              value={actorUid}
              onChange={(e) => setActorUid(e.target.value)}
              placeholder="ops actor uid"
              className="mono"
            />
          </label>
          <label>
            Target uid
            <input
              value={targetUid}
              onChange={(e) => setTargetUid(e.target.value)}
              placeholder="affected captain"
              className="mono"
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void onLoad()}
          >
            {busy ? 'Loading…' : 'Load audit'}
          </button>
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
      </section>

      <section className="panel" aria-labelledby="audit-results-title">
        <h2 id="audit-results-title">Entries</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">Target</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5}>No entries loaded.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{fmtWhen(entry.at)}</td>
                    <td className="mono">{entry.action}</td>
                    <td className="mono" style={{ fontSize: '0.72rem' }}>
                      {entry.actorUid.slice(0, 10)}…
                    </td>
                    <td className="mono" style={{ fontSize: '0.72rem' }}>
                      {entry.targetUid
                        ? `${entry.targetUid.slice(0, 10)}…`
                        : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setSelected(entry)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <section className="panel" aria-labelledby="audit-detail-title">
          <h2 id="audit-detail-title">
            Detail · <code className="mono">{selected.action}</code>
          </h2>
          <p>
            <strong>When:</strong> {fmtWhen(selected.at)}
          </p>
          <p>
            <strong>Actor:</strong>{' '}
            <code className="mono">{selected.actorUid}</code> (
            {selected.actorLabel})
          </p>
          <p>
            <strong>Target:</strong>{' '}
            <code className="mono">{selected.targetUid ?? '—'}</code>
          </p>
          <pre
            className="mono"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.78rem',
              maxHeight: '22rem',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(selected.detail, null, 2)}
          </pre>
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
