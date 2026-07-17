import { useCallback, useEffect, useState } from 'react';

import {
  getOpsGame,
  getOpsHands,
  listActiveGames,
  searchGames,
  type OpsGameSummary,
  type OpsHandRow,
} from '../firebase/games-service';
import {
  listStaleGames,
  opsCleanupStaleSector,
  opsDropSpectators,
  opsKickCaptain,
  opsTerminateSector,
  setAllowSpectate,
} from '../firebase/moderation-service';
import { opsUnrateOnlineSector } from '../firebase/tei-service';
import { useOpsAuth } from '../firebase/ops-auth';

type CoachPresenceRow = {
  playerId: string;
  coachRequestedAt: string;
  coachRoundNumber: number | null;
  coachUsedThisRound: boolean;
};

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

function SectorTable({
  games,
  busy,
  onOpen,
}: {
  games: OpsGameSummary[];
  busy: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Phase</th>
            <th scope="col">Sector id</th>
            <th scope="col">Fleet</th>
            <th scope="col">Host</th>
            <th scope="col">Updated</th>
            <th scope="col">Created</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {games.length === 0 ? (
            <tr>
              <td colSpan={7}>No sectors.</td>
            </tr>
          ) : (
            games.map((g) => (
              <tr key={g.id}>
                <td>
                  <span className="badge">{g.phase}</span>
                  {g.opsTerminated ? (
                    <>
                      {' '}
                      <span className="badge active">ops</span>
                    </>
                  ) : null}
                  {g.rated ? null : (
                    <>
                      {' '}
                      <span className="badge anon">casual</span>
                    </>
                  )}
                </td>
                <td className="mono">{g.id}</td>
                <td>
                  {g.captainCount}/{g.maxPlayers} · Warp {g.maxPip} ·{' '}
                  {g.objective}
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                    {g.captains
                      .map((c) =>
                        c.isAi ? `${c.displayName} (AI)` : c.displayName
                      )
                      .join(', ')}
                  </div>
                </td>
                <td className="mono">{g.hostId.slice(0, 10)}…</td>
                <td>{fmtWhen(g.updatedAt)}</td>
                <td>{fmtWhen(g.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    aria-label={`Inspect sector ${g.id}`}
                    onClick={() => onOpen(g.id)}
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
  );
}

export function SectorsPanel() {
  const { isAdmin } = useOpsAuth();
  const [active, setActive] = useState<OpsGameSummary[]>([]);
  const [results, setResults] = useState<OpsGameSummary[]>([]);
  const [openGame, setOpenGame] = useState<OpsGameSummary | null>(null);
  const [detailJson, setDetailJson] = useState<string | null>(null);
  const [coachPresence, setCoachPresence] = useState<CoachPresenceRow[]>([]);
  const [hands, setHands] = useState<OpsHandRow[] | null>(null);
  const [kickUid, setKickUid] = useState('');
  const [kickReason, setKickReason] = useState('');
  const [termReason, setTermReason] = useState('');
  const [unrateReason, setUnrateReason] = useState('');
  const [stale, setStale] = useState<
    Array<{
      id: string;
      phase: string;
      hostId: string;
      updatedAt: string;
      opsTerminated: boolean;
      captainCount: number;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [gameId, setGameId] = useState('');
  const [hostId, setHostId] = useState('');
  const [phase, setPhase] = useState('');
  const [rated, setRated] = useState<'any' | 'yes' | 'no'>('any');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');

  const refreshActive = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await listActiveGames(100);
      setActive(res.games);
      setStatus(
        `Active: ${res.games.length} sector(s)` +
          (res.scanned != null ? ` (scanned ${res.scanned} recent)` : '')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list active sectors.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshActive();
  }, [refreshActive]);

  const onSearch = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await searchGames({
        gameId: gameId.trim() || undefined,
        hostId: hostId.trim() || undefined,
        phase: phase.trim() || undefined,
        rated: rated === 'any' ? null : rated === 'yes',
        fromIso: toDayStartIso(fromDay),
        toIso: toDayEndIso(toDay),
        limit: 50,
      });
      setResults(res.games);
      setStatus(`Search returned ${res.games.length} sector(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await getOpsGame(id);
      setOpenGame(res.game);
      setDetailJson(JSON.stringify({ game: res.game, detail: res.detail }, null, 2));
      const presenceRaw = res.detail.coachPresence;
      const rows: CoachPresenceRow[] = [];
      if (presenceRaw && typeof presenceRaw === 'object') {
        for (const [playerId, raw] of Object.entries(
          presenceRaw as Record<string, unknown>
        )) {
          if (!raw || typeof raw !== 'object') {
            continue;
          }
          const p = raw as {
            coachRequestedAt?: unknown;
            coachRoundNumber?: unknown;
            coachUsedThisRound?: unknown;
          };
          rows.push({
            playerId,
            coachRequestedAt: String(p.coachRequestedAt ?? ''),
            coachRoundNumber:
              typeof p.coachRoundNumber === 'number' ? p.coachRoundNumber : null,
            coachUsedThisRound: p.coachUsedThisRound === true,
          });
        }
      }
      setCoachPresence(rows);
      setHands(null);
      setKickUid('');
      setKickReason('');
      setTermReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sector.');
    } finally {
      setBusy(false);
    }
  };

  const onInspectHands = async () => {
    if (!openGame) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await getOpsHands(openGame.id);
      setHands(res.hands);
      setStatus(
        `Loaded ${res.hands.length} hand doc(s) · phase ${res.phase}${
          res.roundPhase ? ` / round ${res.roundPhase}` : ''
        }.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load hands.');
    } finally {
      setBusy(false);
    }
  };

  const onKick = async () => {
    if (!openGame || !kickUid.trim()) {
      setError('Pick a captain uid to kick.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await opsKickCaptain({
        gameId: openGame.id,
        targetUid: kickUid.trim(),
        reason: kickReason.trim() || undefined,
      });
      setStatus(
        res.mode === 'terminated'
          ? `Kick forced terminate (fleet too small). Remaining ${res.remaining}.`
          : `Kicked ${kickUid}. Remaining ${res.remaining}.`
      );
      await onOpen(openGame.id);
      await refreshActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kick failed.');
      setBusy(false);
    }
  };

  const onUnrate = async () => {
    if (!openGame) {
      return;
    }
    if (!unrateReason.trim()) {
      setError('Unrate requires a reason.');
      return;
    }
    if (
      !window.confirm(
        'Soft-unrate this online sector? Strips claim ids and voids the ON- certificate / ledger; does not cascade μ/σ.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await opsUnrateOnlineSector(
        openGame.id,
        unrateReason.trim()
      );
      setStatus(
        res.alreadyUnrated
          ? `Sector ${openGame.id} was already unrated.`
          : `Unrated sector ${openGame.id} (${res.strippedCount ?? 0} stats stripped; ledger ${res.ledgerEventsMarked ?? 0}).`
      );
      setUnrateReason('');
      await onOpen(openGame.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unrate failed.');
      setBusy(false);
    }
  };

  const onTerminate = async (mode: 'soft' | 'hard') => {
    if (!openGame) {
      return;
    }
    const label =
      mode === 'hard'
        ? 'Hard-delete this sector and all messages/hands?'
        : 'Soft-terminate this sector (keep evidence, unrate, freeze play)?';
    if (!window.confirm(label)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await opsTerminateSector({
        gameId: openGame.id,
        reason: termReason.trim() || undefined,
        mode,
      });
      setStatus(
        mode === 'hard'
          ? `Hard-deleted sector ${openGame.id}.`
          : `Soft-terminated sector ${openGame.id}.`
      );
      if (mode === 'hard') {
        setOpenGame(null);
        setDetailJson(null);
      } else {
        await onOpen(openGame.id);
      }
      await refreshActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terminate failed.');
      setBusy(false);
    }
  };

  const onLoadStale = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await listStaleGames({ olderThanDays: 7, limit: 50 });
      setStale(res.games);
      setStatus(`Stale candidates: ${res.games.length} (cutoff ${res.cutoff}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stale list failed.');
    } finally {
      setBusy(false);
    }
  };

  const onCleanup = async (id: string) => {
    if (!window.confirm(`Hard-delete stale sector ${id}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await opsCleanupStaleSector(id);
      setStale((prev) => prev.filter((g) => g.id !== id));
      setStatus(`Cleaned up ${id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed.');
    } finally {
      setBusy(false);
    }
  };

  const onDropSpectators = async () => {
    if (!openGame) {
      return;
    }
    if (!window.confirm(`Drop all spectators from ${openGame.id}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await opsDropSpectators(openGame.id);
      setStatus(`Dropped ${res.dropped} spectator(s).`);
      await onOpen(openGame.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drop spectators failed.');
      setBusy(false);
    }
  };

  const onForceAllowSpectate = async (allow: boolean) => {
    if (!openGame) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setAllowSpectate(openGame.id, allow);
      setStatus(
        allow
          ? `Forced allow spectate on ${openGame.id}.`
          : `Closed spectate on ${openGame.id}.`
      );
      await onOpen(openGame.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allow spectate failed.');
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="active-sectors-title">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <h2 id="active-sectors-title" style={{ margin: 0 }}>
            Active sectors
          </h2>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void refreshActive()}
          >
            Refresh
          </button>
        </div>
        <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
          Lobby, active, and round-end sectors (most recently updated).
        </p>
        <SectorTable games={active} busy={busy} onOpen={(id) => void onOpen(id)} />
      </section>

      <section className="panel" aria-labelledby="search-sectors-title">
        <h2 id="search-sectors-title">Historical search</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Find sectors by id, host, phase, rated flag, or created date (complaint
          windows).
        </p>
        <div className="grid two">
          <label>
            Sector id
            <input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="exact id…"
            />
          </label>
          <label>
            Host uid
            <input
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            Phase
            <select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="">Any</option>
              <option value="lobby">lobby</option>
              <option value="active">active</option>
              <option value="round-end">round-end</option>
              <option value="complete">complete</option>
            </select>
          </label>
          <label>
            Rated
            <select
              value={rated}
              onChange={(e) =>
                setRated(e.target.value as 'any' | 'yes' | 'no')
              }
            >
              <option value="any">Any</option>
              <option value="yes">Rated</option>
              <option value="no">Casual</option>
            </select>
          </label>
          <label>
            Created from (UTC day)
            <input
              type="date"
              value={fromDay}
              onChange={(e) => setFromDay(e.target.value)}
            />
          </label>
          <label>
            Created to (UTC day)
            <input
              type="date"
              value={toDay}
              onChange={(e) => setToDay(e.target.value)}
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
        </div>
        <SectorTable
          games={results}
          busy={busy}
          onOpen={(id) => void onOpen(id)}
        />
      </section>

      {isAdmin ? (
      <section className="panel" aria-labelledby="stale-sectors-title">
        <h2 id="stale-sectors-title">Stale cleanup</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Lobby / complete / ops-terminated sectors idle for 7+ days.
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void onLoadStale()}
          >
            List stale
          </button>
        </div>
        {stale.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Phase</th>
                  <th scope="col">Sector</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stale.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span className="badge">{g.phase}</span>
                      {g.opsTerminated ? (
                        <>
                          {' '}
                          <span className="badge active">ops</span>
                        </>
                      ) : null}
                    </td>
                    <td className="mono">{g.id}</td>
                    <td>{fmtWhen(g.updatedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={busy}
                        aria-label={`Hard-delete stale sector ${g.id}`}
                        onClick={() => void onCleanup(g.id)}
                      >
                        Hard delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      ) : null}

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

      {openGame && detailJson ? (
        <section className="panel" aria-labelledby="sector-detail-title">
          <h2 id="sector-detail-title">
            Sector · <code className="mono">{openGame.id}</code>
            {openGame.opsTerminated ? (
              <>
                {' '}
                <span className="badge active">terminated</span>
              </>
            ) : null}
          </h2>

          <h3 style={{ fontSize: '1rem' }}>Kick captain</h3>
          <div className="grid two">
            <label>
              Target
              <select
                value={kickUid}
                onChange={(e) => setKickUid(e.target.value)}
              >
                <option value="">Select seat…</option>
                {openGame.captains
                  .filter((c) => !c.isAi)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.id.slice(0, 8)}…)
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Reason
              <input
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
                placeholder="optional audit reason"
              />
            </label>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy || !kickUid || openGame.opsTerminated}
              onClick={() => void onKick()}
            >
              Kick
            </button>
          </div>

          <h3 style={{ fontSize: '1rem' }}>Spectate / supervision</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Gallery:{' '}
            {openGame.allowSpectate === false ? 'closed' : 'open'} ·{' '}
            {openGame.spectatorCount ?? 0} spectator(s)
          </p>
          <div className="actions">
            <a
              className="btn"
              href={`https://warp.iwdf.org/online/${openGame.id}/watch?ops=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Supervise (Bridge)
            </a>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onForceAllowSpectate(true)}
            >
              Force allow spectate
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onForceAllowSpectate(false)}
            >
              Close spectate
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={() => void onDropSpectators()}
            >
              Drop spectators
            </button>
          </div>

          <h3 style={{ fontSize: '1rem' }}>Coach presence</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Tactical advisor signals from{' '}
            <code>games/…/presence</code> (used for TEI eligibility).
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Captain</th>
                  <th scope="col">Round</th>
                  <th scope="col">Used</th>
                  <th scope="col">Requested</th>
                </tr>
              </thead>
              <tbody>
                {coachPresence.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No presence docs.</td>
                  </tr>
                ) : (
                  coachPresence.map((row) => {
                    const cap = openGame.captains.find(
                      (c) => c.id === row.playerId
                    );
                    return (
                      <tr key={row.playerId}>
                        <td>
                          {cap?.displayName ?? 'Captain'}
                          <br />
                          <span className="mono" style={{ fontSize: '0.7rem' }}>
                            {row.playerId}
                          </span>
                        </td>
                        <td>{row.coachRoundNumber ?? '—'}</td>
                        <td>
                          {row.coachUsedThisRound ? (
                            <span className="badge active">yes</span>
                          ) : (
                            'no'
                          )}
                        </td>
                        <td>{fmtWhen(row.coachRequestedAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '1rem' }}>Unrate (no cascade)</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Soft-unrate an online sector: strip TEI claim ids, void ON-
            certificate + ledger events. Leaves μ/σ unchanged — use Captains
            override or cascade separately if needed. Admin only.
          </p>
          <label>
            Reason (required)
            <input
              value={unrateReason}
              onChange={(e) => setUnrateReason(e.target.value)}
              placeholder="Integrity review / complaint"
              disabled={!isAdmin}
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn danger"
              disabled={busy || !isAdmin || !unrateReason.trim()}
              onClick={() => void onUnrate()}
            >
              Unrate online sector
            </button>
          </div>

          <h3 style={{ fontSize: '1rem' }}>Terminate</h3>
          <label>
            Reason
            <input
              value={termReason}
              onChange={(e) => setTermReason(e.target.value)}
              placeholder="optional"
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn danger"
              disabled={busy || openGame.opsTerminated}
              onClick={() => void onTerminate('soft')}
            >
              Soft terminate
            </button>
            {isAdmin ? (
              <>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => void onTerminate('hard')}
                >
                  Hard delete
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void onInspectHands()}
                >
                  Inspect hands
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setOpenGame(null);
                setDetailJson(null);
                setCoachPresence([]);
                setHands(null);
              }}
            >
              Close
            </button>
          </div>

          {hands ? (
            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Captain</th>
                    <th scope="col">Tiles</th>
                    <th scope="col">Seated</th>
                    <th scope="col">Hand</th>
                  </tr>
                </thead>
                <tbody>
                  {hands.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No hand documents.</td>
                    </tr>
                  ) : (
                    hands.map((h) => (
                      <tr key={h.playerId}>
                        <td>
                          {h.displayName}
                          <br />
                          <span className="mono" style={{ fontSize: '0.7rem' }}>
                            {h.playerId}
                          </span>
                        </td>
                        <td>{h.tileCount}</td>
                        <td>{h.seated ? 'yes' : 'no'}</td>
                        <td className="mono" style={{ fontSize: '0.72rem' }}>
                          {JSON.stringify(h.tiles)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          <pre
            className="mono"
            style={{
              marginTop: '1rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.78rem',
              maxHeight: '22rem',
              overflow: 'auto',
            }}
          >
            {detailJson}
          </pre>
        </section>
      ) : null}
    </>
  );
}
