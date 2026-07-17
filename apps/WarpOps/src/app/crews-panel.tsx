import { useEffect, useState } from 'react';

import {
  opsClearCharterJoinRequests,
  opsCloseCharter,
  opsGetCharter,
  opsListCharters,
  opsRemoveCharterMember,
  resetGlobalOfficialSeason,
  type CharterJoinRequest,
  type CharterMember,
  type CharterSummary,
} from '../firebase/crews-service';
import { useOpsAuth } from '../firebase/ops-auth';

function fmtWhen(iso: string): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function CrewsPanel() {
  const { isAdmin } = useOpsAuth();
  const [search, setSearch] = useState('');
  const [charters, setCharters] = useState<CharterSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<CharterMember[]>([]);
  const [pending, setPending] = useState<CharterJoinRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seasonLabel, setSeasonLabel] = useState('');

  const selected = charters.find((c) => c.charterId === selectedId) ?? null;

  const refreshList = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await opsListCharters(search, 200);
      setCharters(res.charters);
      setStatus(`Loaded ${res.charters.length} crew(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load crews.');
    } finally {
      setBusy(false);
    }
  };

  const loadDetail = async (charterId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await opsGetCharter(charterId);
      setSelectedId(charterId);
      setMembers(res.members);
      setPending(res.pendingRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load crew.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const removeMember = async (uid: string, displayName: string) => {
    if (!selected) {
      return;
    }
    const reason =
      window.prompt(`Remove ${displayName} from ${selected.name}? Reason:`) ?? '';
    if (!reason.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await opsRemoveCharterMember({
        charterId: selected.charterId,
        targetUid: uid,
        reason: reason.trim(),
      });
      setStatus(`Removed ${displayName}.`);
      await loadDetail(selected.charterId);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed.');
      setBusy(false);
    }
  };

  const clearRequests = async () => {
    if (!selected) {
      return;
    }
    const reason =
      window.prompt(`Reject all pending requests for ${selected.name}? Reason:`) ??
      '';
    if (!reason.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await opsClearCharterJoinRequests({
        charterId: selected.charterId,
        reason: reason.trim(),
      });
      setStatus(`Cleared ${res.cleared} request(s).`);
      await loadDetail(selected.charterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed.');
      setBusy(false);
    }
  };

  const closeCharter = async () => {
    if (!selected) {
      return;
    }
    const reason =
      window.prompt(
        `Close (delete) ${selected.name}? This removes members + requests. Reason:`
      ) ?? '';
    if (!reason.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await opsCloseCharter({
        charterId: selected.charterId,
        reason: reason.trim(),
      });
      setStatus(`Closed ${selected.name}.`);
      setSelectedId(null);
      setMembers([]);
      setPending([]);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Close failed.');
      setBusy(false);
    }
  };

  const resetSeason = async () => {
    const label = seasonLabel.trim();
    if (!label) {
      setError('Enter a season label first.');
      return;
    }
    if (
      !window.confirm(
        `Reset ALL Global Official fleets to season "${label}"? Current standings are archived.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetGlobalOfficialSeason({ seasonLabel: label });
      setStatus(`Global Official season reset to "${label}".`);
      setSeasonLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Season reset failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="crews-title">
        <h2 id="crews-title">Crews (charters)</h2>
        <div className="grid two">
          <label>
            Search name / slug / id
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void refreshList();
                }
              }}
              placeholder="e.g. bridge crew"
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void refreshList()}
          >
            Search
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Members</th>
                <th scope="col">Objective</th>
                <th scope="col">Listed</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {charters.length === 0 ? (
                <tr>
                  <td colSpan={6}>No crews found.</td>
                </tr>
              ) : (
                charters.map((crew) => (
                  <tr key={crew.charterId}>
                    <td>
                      {crew.name}
                      {crew.isGlobalOfficial ? (
                        <span className="badge">official</span>
                      ) : null}
                    </td>
                    <td>{crew.memberCount}</td>
                    <td>{crew.objective}</td>
                    <td>{crew.listed ? 'yes' : 'no'}</td>
                    <td>{fmtWhen(crew.updatedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        aria-label={`Open crew ${crew.name}`}
                        onClick={() => void loadDetail(crew.charterId)}
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
        <section className="panel" aria-labelledby="crew-detail-title">
          <h2 id="crew-detail-title">{selected.name}</h2>
          <p className="mono" style={{ marginTop: 0 }}>
            {selected.charterId}
          </p>
          <p style={{ color: 'var(--muted)' }}>
            Owner {selected.createdBy} · {selected.memberCount} members ·{' '}
            {selected.objective} · created {fmtWhen(selected.createdAt)}
          </p>

          <h3>Members</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Captain</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.uid}>
                    <td>
                      {m.displayName}
                      <br />
                      <span className="mono" style={{ fontSize: '0.7rem' }}>
                        {m.uid}
                      </span>
                    </td>
                    <td>{m.role}</td>
                    <td>{fmtWhen(m.joinedAt)}</td>
                    <td>
                      {isAdmin ? (
                      <button
                        type="button"
                        className="btn danger"
                        disabled={busy || m.role === 'owner'}
                        onClick={() => void removeMember(m.uid, m.displayName)}
                      >
                        Remove
                      </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Pending requests ({pending.length})</h3>
          {pending.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No pending join requests.</p>
          ) : (
            <ul>
              {pending.map((r) => (
                <li key={r.uid}>
                  {r.displayName} ({r.uid}) — {fmtWhen(r.requestedAt)}
                </li>
              ))}
            </ul>
          )}

          <div className="actions">
            {isAdmin ? (
              <>
            <button
              type="button"
              className="btn"
              disabled={busy || pending.length === 0}
              onClick={() => void clearRequests()}
            >
              Reject all requests
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={busy || selected.isGlobalOfficial}
              onClick={() => void closeCharter()}
            >
              Close charter
            </button>
              </>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={() => setSelectedId(null)}
            >
              Close detail
            </button>
          </div>
        </section>
      ) : null}

      {isAdmin ? (
      <section className="panel" aria-labelledby="season-title">
        <h2 id="season-title">Global Official season</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Archives current Global Official standings and starts a new season for
          every fleet size. This affects the public leaderboard.
        </p>
        <div className="grid two">
          <label>
            New season label
            <input
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              placeholder="e.g. Season 2 (2026)"
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn danger"
            disabled={busy || !seasonLabel.trim()}
            onClick={() => void resetSeason()}
          >
            Reset Global Official season
          </button>
        </div>
      </section>
      ) : null}
    </>
  );
}
