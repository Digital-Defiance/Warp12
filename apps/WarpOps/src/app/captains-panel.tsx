import { useState } from 'react';

import { banUser } from '../firebase/bans-service';
import {
  addAdminNote,
  deleteAdminNote,
  getCaptainDossier,
  opsSetDisplayName,
  searchCaptains,
  setUserRoles,
  updateAdminNote,
  type AdminNote,
  type CaptainDossier,
  type CaptainSearchHit,
  type WarpOpsRole,
} from '../firebase/captains-service';
import { muteUser, unmuteUser } from '../firebase/moderation-service';
import { useOpsAuth } from '../firebase/ops-auth';
import {
  getOpsRatedMatch,
  listCaptainRatingEvents,
  listMatchRatingEvents,
  opsCascadeFromRatingEvent,
  opsSetCaptainRating,
  opsVoidRatedMatch,
  type LocalAiSkill,
  type TeiPool,
  type TeiTrack,
} from '../firebase/tei-service';

function fmtWhen(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

type RatingRow = {
  key: string;
  pool: string;
  track: string;
  mu: number;
  sigma: number;
  matches: number;
  display: number;
  grade: string;
  wins: number;
};

function readRatingRows(stats: CaptainDossier['stats']): RatingRow[] {
  if (!stats) {
    return [];
  }
  const rows: RatingRow[] = [];
  const pushBucket = (
    pool: string,
    track: string,
    key: string,
    raw: unknown
  ) => {
    if (!raw || typeof raw !== 'object') {
      return;
    }
    const bucket = raw as {
      rating?: {
        mu?: number;
        sigma?: number;
        matches?: number;
        displayRating?: number;
        displayGrade?: string;
      };
      wins?: number;
    };
    const r = bucket.rating;
    if (
      typeof r?.mu !== 'number' ||
      typeof r?.sigma !== 'number' ||
      typeof r?.matches !== 'number'
    ) {
      return;
    }
    rows.push({
      key,
      pool,
      track,
      mu: r.mu,
      sigma: r.sigma,
      matches: r.matches,
      display: typeof r.displayRating === 'number' ? r.displayRating : 0,
      grade: typeof r.displayGrade === 'string' ? r.displayGrade : '—',
      wins: typeof bucket.wins === 'number' ? bucket.wins : 0,
    });
  };

  for (const track of ['goOut', 'points'] as const) {
    pushBucket(
      'human',
      track,
      `human.${track}`,
      (stats.humanRating as Record<string, unknown> | null)?.[track]
    );
    pushBucket(
      'squad',
      track,
      `squad.${track}`,
      (stats.squadRating as Record<string, unknown> | null)?.[track]
    );
  }

  const localAi = stats.localAi as Record<string, Record<string, unknown>> | null;
  if (localAi) {
    for (const skill of Object.keys(localAi)) {
      for (const track of ['goOut', 'points'] as const) {
        pushBucket(
          `localAi/${skill}`,
          track,
          `localAi.${skill}.${track}`,
          localAi[skill]?.[track]
        );
      }
    }
  }

  const group = stats.groupRating as Record<
    string,
    Record<string, unknown>
  > | null;
  if (group) {
    for (const charterId of Object.keys(group)) {
      for (const track of ['goOut', 'points'] as const) {
        pushBucket(
          `group/${charterId}`,
          track,
          `group.${charterId}.${track}`,
          group[charterId]?.[track]
        );
      }
    }
  }

  return rows;
}

export function CaptainsPanel() {
  const { isAdmin, user } = useOpsAuth();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CaptainSearchHit[]>([]);
  const [dossier, setDossier] = useState<CaptainDossier | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [banReason, setBanReason] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renameReason, setRenameReason] = useState('');
  const [muteReason, setMuteReason] = useState('');
  const [muteDays, setMuteDays] = useState('');
  const [muteMode, setMuteMode] = useState<'hard' | 'shadow'>('hard');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const [teiPool, setTeiPool] = useState<TeiPool>('human');
  const [teiTrack, setTeiTrack] = useState<TeiTrack>('points');
  const [teiSkill, setTeiSkill] = useState<LocalAiSkill>('ensign');
  const [teiCharterId, setTeiCharterId] = useState('');
  const [teiMu, setTeiMu] = useState('25');
  const [teiSigma, setTeiSigma] = useState('8.333');
  const [teiMatches, setTeiMatches] = useState('');
  const [teiReason, setTeiReason] = useState('');

  const [matchCode, setMatchCode] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [ratedMatch, setRatedMatch] = useState<Record<string, unknown> | null>(
    null
  );
  const [captainEvents, setCaptainEvents] = useState<
    Record<string, unknown>[]
  >([]);
  const [matchEvents, setMatchEvents] = useState<Record<string, unknown>[]>(
    []
  );
  const [cascadeEventId, setCascadeEventId] = useState('');
  const [cascadeReason, setCascadeReason] = useState('');
  const [cascadePreview, setCascadePreview] = useState<string | null>(null);

  const onSearch = async () => {
    if (query.trim().length < 2) {
      setError('Enter at least 2 characters (uid, email, or name).');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await searchCaptains(query.trim(), 40);
      setHits(res.hits);
      setScanNote(res.note ?? null);
      setStatus(`Found ${res.hits.length} hit(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const openDossier = async (uid: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await getCaptainDossier(uid);
      setDossier({
        ...res.dossier,
        speakAs: res.dossier.speakAs ?? null,
        roles: Array.isArray(res.dossier.roles) ? res.dossier.roles : [],
      });
      setRenameName(res.dossier.displayName);
      setRenameReason('');
      setNoteText('');
      setEditingId(null);
      setRatedMatch(null);
      try {
        const ledger = await listCaptainRatingEvents(uid, 40);
        setCaptainEvents(ledger.events);
      } catch {
        setCaptainEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dossier.');
    } finally {
      setBusy(false);
    }
  };

  const refreshDossier = async () => {
    if (!dossier) {
      return;
    }
    await openDossier(dossier.uid);
  };

  const onRename = async () => {
    if (!dossier || !renameName.trim() || !renameReason.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await opsSetDisplayName({
        uid: dossier.uid,
        displayName: renameName.trim(),
        reason: renameReason.trim(),
      });
      setStatus(
        `Renamed ${res.previous ?? '(none)'} → ${res.displayName}.`
      );
      setRenameReason('');
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed.');
      setBusy(false);
    }
  };

  const onToggleAdmin = async () => {
    if (!dossier || !user) {
      return;
    }
    if (dossier.uid === user.uid) {
      setError('You cannot change your own admin role.');
      return;
    }
    const hasAdmin = dossier.roles.includes('admin');
    const nextRoles: WarpOpsRole[] = hasAdmin
      ? dossier.roles.filter((r): r is WarpOpsRole => r !== 'admin')
      : [...dossier.roles, 'admin'];
    setBusy(true);
    setError(null);
    try {
      const res = await setUserRoles({ uid: dossier.uid, roles: nextRoles });
      setStatus(
        hasAdmin
          ? `Revoked admin from ${dossier.displayName}.`
          : `Granted admin to ${dossier.displayName}.`
      );
      setDossier({ ...dossier, roles: res.roles });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed.');
    } finally {
      setBusy(false);
    }
  };

  const onAddNote = async () => {
    if (!dossier || !noteText.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addAdminNote(dossier.uid, noteText.trim());
      setNoteText('');
      setStatus('Note added.');
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add note.');
      setBusy(false);
    }
  };

  const onSaveEdit = async (note: AdminNote) => {
    if (!dossier || !editText.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateAdminNote(dossier.uid, note.id, editText.trim());
      setEditingId(null);
      setStatus('Note updated.');
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update note.');
      setBusy(false);
    }
  };

  const onDeleteNote = async (noteId: string) => {
    if (!dossier) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAdminNote(dossier.uid, noteId);
      setStatus('Note deleted.');
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete note.');
      setBusy(false);
    }
  };

  const onQuickBan = async () => {
    if (!dossier || !banReason.trim()) {
      setError('Ban reason required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await banUser({
        uid: dossier.uid,
        reason: banReason.trim(),
      });
      setBanReason('');
      setStatus(`Banned ${dossier.uid}.`);
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ban failed.');
      setBusy(false);
    }
  };

  const onMute = async () => {
    if (!dossier || !muteReason.trim()) {
      setError('Mute requires a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const days = muteDays.trim() ? Number(muteDays) : undefined;
      await muteUser({
        uid: dossier.uid,
        reason: muteReason.trim(),
        days: days && Number.isFinite(days) && days > 0 ? days : undefined,
        mode: muteMode,
      });
      setMuteReason('');
      setMuteDays('');
      setStatus(
        muteMode === 'shadow'
          ? `Shadow-muted ${dossier.uid} (messages accepted but hidden from others).`
          : `Muted ${dossier.uid}.`
      );
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mute failed.');
      setBusy(false);
    }
  };

  const onUnmute = async () => {
    if (!dossier) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await unmuteUser(dossier.uid);
      setStatus(`Unmuted ${dossier.uid}.`);
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unmute failed.');
      setBusy(false);
    }
  };

  const fillOverrideFromRow = (row: RatingRow) => {
    if (row.pool === 'human' || row.pool === 'squad') {
      setTeiPool(row.pool);
    } else if (row.pool.startsWith('localAi/')) {
      setTeiPool('localAi');
      setTeiSkill(row.pool.slice('localAi/'.length) as LocalAiSkill);
    } else if (row.pool.startsWith('group/')) {
      setTeiPool('group');
      setTeiCharterId(row.pool.slice('group/'.length));
    }
    setTeiTrack(row.track as TeiTrack);
    setTeiMu(String(row.mu));
    setTeiSigma(String(row.sigma));
    setTeiMatches(String(row.matches));
  };

  const onOverrideRating = async () => {
    if (!dossier) {
      return;
    }
    const mu = Number(teiMu);
    const sigma = Number(teiSigma);
    if (!teiReason.trim()) {
      setError('Override requires a reason.');
      return;
    }
    if (!Number.isFinite(mu) || !Number.isFinite(sigma)) {
      setError('μ and σ must be numbers.');
      return;
    }
    if (teiPool === 'group' && !teiCharterId.trim()) {
      setError('charterId required for group pool.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const matchesRaw = teiMatches.trim();
      const res = await opsSetCaptainRating({
        uid: dossier.uid,
        pool: teiPool,
        track: teiTrack,
        skill: teiPool === 'localAi' ? teiSkill : undefined,
        charterId: teiPool === 'group' ? teiCharterId.trim() : undefined,
        mu,
        sigma,
        matches:
          matchesRaw && Number.isFinite(Number(matchesRaw))
            ? Number(matchesRaw)
            : undefined,
        reason: teiReason.trim(),
      });
      setTeiReason('');
      setStatus(
        `TEI override on ${res.fieldPath}: μ=${res.after.mu.toFixed(3)} σ=${res.after.sigma.toFixed(3)}.`
      );
      await refreshDossier();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed.');
      setBusy(false);
    }
  };

  const onLookupMatch = async () => {
    if (!matchCode.trim()) {
      setError('Match code required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await getOpsRatedMatch(matchCode.trim());
      setRatedMatch(res.match);
      try {
        const ledger = await listMatchRatingEvents(matchCode.trim());
        setMatchEvents(ledger.events);
      } catch {
        setMatchEvents([]);
      }
      setStatus(`Loaded rated match ${matchCode.trim().toUpperCase()}.`);
    } catch (err) {
      setRatedMatch(null);
      setError(err instanceof Error ? err.message : 'Match lookup failed.');
    } finally {
      setBusy(false);
    }
  };

  const onVoidMatch = async () => {
    if (!matchCode.trim() || !voidReason.trim()) {
      setError('Match code and void reason required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await opsVoidRatedMatch(matchCode.trim(), voidReason.trim());
      setVoidReason('');
      setStatus(
        res.alreadyVoided
          ? `Match ${res.matchCode} was already voided.`
          : `Voided ${res.matchCode} (${res.strippedCount ?? 0} claim strip(s)). ${res.note ?? ''}`
      );
      const refreshed = await getOpsRatedMatch(matchCode.trim());
      setRatedMatch(refreshed.match);
      if (dossier) {
        await refreshDossier();
      } else {
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Void failed.');
      setBusy(false);
    }
  };

  const onCascade = async (dryRun: boolean) => {
    if (!cascadeEventId.trim() || !cascadeReason.trim()) {
      setError('Cascade requires eventId and reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await opsCascadeFromRatingEvent({
        eventId: cascadeEventId.trim(),
        reason: cascadeReason.trim(),
        dryRun,
      });
      setCascadePreview(JSON.stringify(res, null, 2));
      setStatus(
        dryRun
          ? `Cascade dry-run for ${res.eventId} (${res.results.length} captain(s)).`
          : `Cascaded ${res.eventId} — personal timelines rewritten.`
      );
      if (!dryRun) {
        setCascadeReason('');
        if (dossier) {
          await refreshDossier();
        } else {
          setBusy(false);
        }
      } else {
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cascade failed.');
      setBusy(false);
    }
  };

  const ratingRows = readRatingRows(dossier?.stats ?? null);

  return (
    <>
      <section className="panel" aria-labelledby="captain-search-title">
        <h2 id="captain-search-title">Search captains</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          UID, Google email, or display-name substring (e.g. banned words in
          callsigns). Name search scans recent playerStats.
        </p>
        <div className="grid two">
          <label>
            Query
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void onSearch();
                }
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="uid, email, or name…"
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Match</th>
                <th scope="col">Name</th>
                <th scope="col">UID</th>
                <th scope="col">Record</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hits.length === 0 ? (
                <tr>
                  <td colSpan={5}>No hits yet.</td>
                </tr>
              ) : (
                hits.map((h) => (
                  <tr key={h.uid}>
                    <td>
                      <span className="badge">{h.match}</span>
                    </td>
                    <td>{h.displayName}</td>
                    <td className="mono">{h.uid}</td>
                    <td>
                      {h.matchesWon}/{h.matchesCompleted} ·{' '}
                      {fmtWhen(h.lastPlayedAt ?? h.updatedAt)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        aria-label={`Open dossier for ${h.displayName}`}
                        onClick={() => void openDossier(h.uid)}
                      >
                        Dossier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {scanNote ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{scanNote}</p>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="rated-match-title">
        <h2 id="rated-match-title">Official rated match</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Lookup <code>ratedMatches/MT-…</code>. Soft-void strips claim ids and
          marks the match voided; it does not rewind μ/σ.
        </p>
        <div className="grid two">
          <label>
            Match code
            <input
              value={matchCode}
              onChange={(e) => setMatchCode(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="MT-…"
            />
          </label>
          <label>
            Void reason
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Required to void"
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy || !matchCode.trim()}
            onClick={() => void onLookupMatch()}
          >
            Lookup
          </button>
          {isAdmin ? (
          <button
            type="button"
            className="btn danger"
            disabled={busy || !matchCode.trim() || !voidReason.trim()}
            onClick={() => void onVoidMatch()}
          >
            Soft-void match
          </button>
          ) : null}
        </div>
        {ratedMatch ? (
          <pre
            className="mono"
            style={{
              margin: '0.75rem 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.72rem',
              maxHeight: '18rem',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(ratedMatch, null, 2)}
          </pre>
        ) : null}
        {matchEvents.length > 0 ? (
          <>
            <h3 style={{ fontSize: '1rem' }}>Ledger events for match</h3>
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
              {JSON.stringify(matchEvents, null, 2)}
            </pre>
          </>
        ) : null}
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

      {dossier ? (
        <section className="panel" aria-labelledby="dossier-title">
          <h2 id="dossier-title">
            Dossier · {dossier.displayName}
            {dossier.banned ? (
              <>
                {' '}
                <span className="badge active">banned</span>
              </>
            ) : null}
            {dossier.roles.includes('admin') ? (
              <>
                {' '}
                <span className="badge active">admin</span>
              </>
            ) : null}
            {dossier.roles.includes('moderator') ? (
              <>
                {' '}
                <span className="badge">moderator</span>
              </>
            ) : null}
            {dossier.muted ? (
              <>
                {' '}
                <span className="badge anon">muted</span>
              </>
            ) : null}
          </h2>
          <div className="grid two">
            <div>
              <p className="mono" style={{ marginTop: 0 }}>
                {dossier.uid}
              </p>
              <p style={{ color: 'var(--muted)' }}>
                {dossier.email ?? (dossier.anonymous ? 'anonymous' : 'no email')}{' '}
                · {dossier.providers.join(', ') || 'no providers'}
                {dossier.authDisabled ? ' · Auth disabled' : ''}
              </p>
              <p style={{ color: 'var(--muted)' }}>
                Spoken as · {dossier.speakAs ?? '(none)'}
              </p>
              <p style={{ color: 'var(--muted)' }}>
                Auth created {fmtWhen(dossier.createdAt)} · last sign-in{' '}
                {fmtWhen(dossier.lastSignInAt)}
              </p>
              {dossier.stats ? (
                <p>
                  Stats {dossier.stats.matchesWon}/{dossier.stats.matchesCompleted}{' '}
                  · last played {fmtWhen(dossier.stats.lastPlayedAt)}
                </p>
              ) : (
                <p style={{ color: 'var(--muted)' }}>No playerStats doc.</p>
              )}
              <label>
                Display name
                <input
                  value={renameName}
                  maxLength={24}
                  onChange={(e) => setRenameName(e.target.value)}
                />
              </label>
              <label>
                Rename reason
                <input
                  value={renameReason}
                  onChange={(e) => setRenameReason(e.target.value)}
                  placeholder="Required for audit"
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  disabled={
                    busy ||
                    !renameName.trim() ||
                    !renameReason.trim() ||
                    renameName.trim() === dossier.displayName
                  }
                  onClick={() => void onRename()}
                >
                  Save display name
                </button>
              </div>
            </div>
            <div>
              <label>
                Global mute reason
                <input
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  placeholder="Required to mute"
                />
              </label>
              <label>
                Mute days (optional)
                <input
                  value={muteDays}
                  onChange={(e) => setMuteDays(e.target.value)}
                  placeholder="blank = until unmuted"
                  inputMode="numeric"
                />
              </label>
              <label>
                Mute mode
                <select
                  value={muteMode}
                  onChange={(e) =>
                    setMuteMode(e.target.value === 'shadow' ? 'shadow' : 'hard')
                  }
                >
                  <option value="hard">Hard (block sends)</option>
                  <option value="shadow">Shadow (hide from others)</option>
                </select>
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || dossier.muted || !muteReason.trim()}
                  onClick={() => void onMute()}
                >
                  Mute (global)
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !dossier.muted}
                  onClick={() => void onUnmute()}
                >
                  Unmute
                </button>
              </div>
              {isAdmin ? (
                <>
              <label>
                Quick ban reason
                <input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Required to ban"
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy || dossier.banned}
                  onClick={() => void onQuickBan()}
                >
                  Ban this uid
                </button>
                <button
                  type="button"
                  className={
                    dossier.roles.includes('admin') ? 'btn danger' : 'btn primary'
                  }
                  disabled={busy || dossier.uid === user?.uid}
                  title={
                    dossier.uid === user?.uid
                      ? 'Another admin must change your role'
                      : undefined
                  }
                  onClick={() => void onToggleAdmin()}
                >
                  {dossier.roles.includes('admin')
                    ? 'Revoke admin'
                    : 'Grant admin'}
                </button>
              </div>
                </>
              ) : null}
              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void refreshDossier()}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setDossier(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '1rem' }}>TEI ratings</h3>
          {ratingRows.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No OpenSkill tracks on file.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Pool</th>
                    <th scope="col">Track</th>
                    <th scope="col">μ</th>
                    <th scope="col">σ</th>
                    <th scope="col">Matches</th>
                    <th scope="col">Display</th>
                    <th scope="col">Grade</th>
                    <th scope="col">Wins</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ratingRows.map((row) => (
                    <tr key={row.key}>
                      <td className="mono">{row.pool}</td>
                      <td>{row.track}</td>
                      <td className="mono">{row.mu.toFixed(3)}</td>
                      <td className="mono">{row.sigma.toFixed(3)}</td>
                      <td>{row.matches}</td>
                      <td className="mono">{row.display.toFixed(2)}</td>
                      <td>{row.grade}</td>
                      <td>{row.wins}</td>
                      <td>
                        {isAdmin ? (
                        <button
                          type="button"
                          className="btn"
                          aria-label={`Fill override form from ${row.pool} ${row.track}`}
                          onClick={() => fillOverrideFromRow(row)}
                        >
                          Edit
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
          )}

          {dossier.stats ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Claims · human {dossier.stats.humanRatedGameIds?.length ?? 0} ·
              squad {dossier.stats.squadRatedGameIds?.length ?? 0} · group{' '}
              {dossier.stats.groupRatedIds?.length ?? 0}
            </p>
          ) : null}

          <h3 style={{ fontSize: '1rem' }}>TEI ledger</h3>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Append-only <code>ratingEvents</code>. Cascade rewinds μ/σ to the
            event’s before-rating, then replays later events on each captain’s
            personal timeline (opponent priors stay frozen — Scope A).
          </p>
          {captainEvents.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              No ledger events yet (only matches rated after ledger deploy).
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Pool</th>
                    <th scope="col">Track</th>
                    <th scope="col">Match</th>
                    <th scope="col">Source</th>
                    <th scope="col">Voided</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {captainEvents.map((ev) => (
                    <tr key={String(ev.eventId)}>
                      <td className="mono">{fmtWhen(String(ev.playedAt ?? ''))}</td>
                      <td>{String(ev.pool ?? '—')}</td>
                      <td>{String(ev.track ?? '—')}</td>
                      <td className="mono">{String(ev.matchId ?? '—')}</td>
                      <td>{String(ev.source ?? '—')}</td>
                      <td>{ev.voided === true ? 'yes' : '—'}</td>
                      <td>
                        {isAdmin ? (
                        <button
                          type="button"
                          className="btn"
                          aria-label={`Use event ${String(ev.eventId)} for cascade`}
                          onClick={() =>
                            setCascadeEventId(String(ev.eventId ?? ''))
                          }
                        >
                          Cascade
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
          )}

          {isAdmin ? (
            <>
          <h3 style={{ fontSize: '1rem' }}>Cascade from ledger event</h3>
          <div className="grid two">
            <label>
              Event id
              <input
                value={cascadeEventId}
                onChange={(e) => setCascadeEventId(e.target.value)}
                className="mono"
                autoComplete="off"
                spellCheck={false}
                placeholder="official:MT-…:human"
              />
            </label>
            <label>
              Reason
              <input
                value={cascadeReason}
                onChange={(e) => setCascadeReason(e.target.value)}
                placeholder="Required"
              />
            </label>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={
                busy || !cascadeEventId.trim() || !cascadeReason.trim()
              }
              onClick={() => void onCascade(true)}
            >
              Dry-run cascade
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={
                busy || !cascadeEventId.trim() || !cascadeReason.trim()
              }
              onClick={() => void onCascade(false)}
            >
              Apply cascade
            </button>
          </div>
          {cascadePreview ? (
            <pre
              className="mono"
              style={{
                margin: '0.75rem 0 0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '0.72rem',
                maxHeight: '16rem',
                overflow: 'auto',
              }}
            >
              {cascadePreview}
            </pre>
          ) : null}

          <h3 style={{ fontSize: '1rem' }}>Manual TEI override</h3>
            </>
          ) : null}
          {isAdmin ? (
            <>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Sets μ/σ on one track and recomputes display grade. Audited as{' '}
            <code>tei_override</code>.
          </p>
          <div className="grid two">
            <label>
              Pool
              <select
                value={teiPool}
                onChange={(e) => setTeiPool(e.target.value as TeiPool)}
              >
                <option value="human">human</option>
                <option value="squad">squad</option>
                <option value="localAi">localAi</option>
                <option value="group">group</option>
              </select>
            </label>
            <label>
              Track
              <select
                value={teiTrack}
                onChange={(e) => setTeiTrack(e.target.value as TeiTrack)}
              >
                <option value="points">points</option>
                <option value="goOut">goOut</option>
              </select>
            </label>
            {teiPool === 'localAi' ? (
              <label>
                Skill
                <select
                  value={teiSkill}
                  onChange={(e) =>
                    setTeiSkill(e.target.value as LocalAiSkill)
                  }
                >
                  <option value="ensign">ensign</option>
                  <option value="lieutenant">lieutenant</option>
                  <option value="commander">commander</option>
                </select>
              </label>
            ) : null}
            {teiPool === 'group' ? (
              <label>
                Charter id
                <input
                  value={teiCharterId}
                  onChange={(e) => setTeiCharterId(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            ) : null}
            <label>
              μ
              <input
                value={teiMu}
                onChange={(e) => setTeiMu(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label>
              σ
              <input
                value={teiSigma}
                onChange={(e) => setTeiSigma(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label>
              Matches (optional)
              <input
                value={teiMatches}
                onChange={(e) => setTeiMatches(e.target.value)}
                inputMode="numeric"
                placeholder="keep current"
              />
            </label>
            <label>
              Reason
              <input
                value={teiReason}
                onChange={(e) => setTeiReason(e.target.value)}
                placeholder="Required"
              />
            </label>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !teiReason.trim()}
              onClick={() => void onOverrideRating()}
            >
              Apply override
            </button>
          </div>
            </>
          ) : null}

          <h3 style={{ fontSize: '1rem' }}>Admin notes</h3>
          <label>
            New note
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Internal only — never shown to the captain"
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !noteText.trim()}
              onClick={() => void onAddNote()}
            >
              Add note
            </button>
          </div>
          <ul style={{ paddingLeft: '1.1rem' }}>
            {dossier.notes.length === 0 ? (
              <li style={{ color: 'var(--muted)' }}>No notes yet.</li>
            ) : (
              dossier.notes.map((n) => (
                <li key={n.id} style={{ marginBottom: '0.75rem' }}>
                  {editingId === n.id ? (
                    <>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="actions">
                        <button
                          type="button"
                          className="btn primary"
                          disabled={busy}
                          onClick={() => void onSaveEdit(n)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>{n.text}</div>
                      <div
                        className="mono"
                        style={{ color: 'var(--muted)', fontSize: '0.75rem' }}
                      >
                        {fmtWhen(n.createdAt)} · {n.createdByLabel}
                        {n.updatedAt ? ` · edited ${fmtWhen(n.updatedAt)}` : ''}
                      </div>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          aria-label={`Edit note from ${n.createdAt}`}
                          onClick={() => {
                            setEditingId(n.id);
                            setEditText(n.text);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn danger"
                          disabled={busy}
                          aria-label={`Delete note from ${n.createdAt}`}
                          onClick={() => void onDeleteNote(n.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>

          {dossier.stats?.matchHistory &&
          dossier.stats.matchHistory.length > 0 ? (
            <>
              <h3 style={{ fontSize: '1rem' }}>Recent match history</h3>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '0.72rem',
                  maxHeight: '16rem',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(dossier.stats.matchHistory, null, 2)}
              </pre>
            </>
          ) : null}

          {dossier.ban ? (
            <>
              <h3 style={{ fontSize: '1rem' }}>Ban record</h3>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.72rem',
                }}
              >
                {JSON.stringify(dossier.ban, null, 2)}
              </pre>
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
