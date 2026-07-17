import { useCallback, useEffect, useState } from 'react';

import {
  banUser,
  getBan,
  listBans,
  unbanUser,
  type BanRecord,
} from '../firebase/bans-service';

function formatExpiry(ban: BanRecord): string {
  const raw = ban.expiresAt;
  if (!raw) {
    return 'permanent';
  }
  const seconds = raw.seconds ?? raw._seconds;
  if (seconds == null) {
    return 'permanent';
  }
  return new Date(seconds * 1000).toLocaleString();
}

function banKey(ban: BanRecord): string {
  return ban.banId || ban.uid || `${ban.ipv4 ?? ''}-${ban.ipv6 ?? ''}`;
}

function formatIps(ban: BanRecord): string {
  const parts: string[] = [];
  if (ban.ipv4) {
    parts.push(`v4 ${ban.ipv4}`);
  }
  if (ban.ipv6) {
    parts.push(`v6 ${ban.ipv6}`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

export function BansPanel() {
  const [uid, setUid] = useState('');
  const [ipv4, setIpv4] = useState('');
  const [ipv6, setIpv6] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [appealNote, setAppealNote] = useState('');
  const [days, setDays] = useState('');
  const [lookupUid, setLookupUid] = useState('');
  const [lookupIpv4, setLookupIpv4] = useState('');
  const [lookupIpv6, setLookupIpv6] = useState('');
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await listBans({ activeOnly: true, limit: 100 });
      setBans(res.bans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list bans.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onBan = async () => {
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    if (!uid.trim() && !ipv4.trim() && !ipv6.trim()) {
      setError('Provide UID and/or IPv4 and/or IPv6 (one record per subject).');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const daysN = Number(days);
      const expiresAtMs =
        days && Number.isFinite(daysN) && daysN > 0
          ? Date.now() + daysN * 24 * 60 * 60 * 1000
          : null;
      await banUser({
        uid: uid.trim() || undefined,
        ipv4: ipv4.trim() || null,
        ipv6: ipv6.trim() || null,
        reason: reason.trim(),
        notes: notes.trim() || null,
        appealNote: appealNote.trim() || null,
        expiresAtMs,
      });
      setStatus('Ban recorded (uid and/or IPs on one subject).');
      setUid('');
      setIpv4('');
      setIpv6('');
      setReason('');
      setNotes('');
      setAppealNote('');
      setDays('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ban failed.');
    } finally {
      setBusy(false);
    }
  };

  const onUnban = async (ban: BanRecord) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await unbanUser({
        banId: ban.banId || ban.uid,
        uid: ban.uid || undefined,
      });
      setStatus(`Unbanned ${ban.banId || ban.uid}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unban failed.');
    } finally {
      setBusy(false);
    }
  };

  const onLookup = async () => {
    if (!lookupUid.trim() && !lookupIpv4.trim() && !lookupIpv6.trim()) {
      setError('Enter a UID or IP to look up.');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await getBan({
        uid: lookupUid.trim() || undefined,
        ipv4: lookupIpv4.trim() || undefined,
        ipv6: lookupIpv6.trim() || undefined,
      });
      const ipNote = formatIps(res.ban ?? {});
      setStatus(
        res.banned
          ? `Active ban: ${res.ban?.reason ?? '(no reason)'} · ${ipNote}`
          : res.ban
            ? `Ban record exists but is inactive/expired · ${ipNote}`
            : 'No ban record for that query.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="ban-form-title">
        <h2 id="ban-form-title">Ban subject</h2>
        <p id="ban-form-help" style={{ color: 'var(--muted)', marginTop: 0 }}>
          One record per person. Attach Firebase UID and/or IPv4 and/or IPv6
          together so dual-stack stays linked.
        </p>
        <div className="grid two">
          <label>
            Firebase UID (optional if IPs set)
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="uid…"
              aria-describedby="ban-form-help"
            />
          </label>
          <label>
            Days (optional)
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              inputMode="numeric"
              placeholder="blank = permanent"
            />
          </label>
          <label>
            IPv4
            <input
              value={ipv4}
              onChange={(e) => setIpv4(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="1.2.3.4"
            />
          </label>
          <label>
            IPv6
            <input
              value={ipv6}
              onChange={(e) => setIpv6(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="2001:db8::1"
            />
          </label>
        </div>
        <div className="grid" style={{ marginTop: '0.75rem' }}>
          <label>
            Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required"
            />
          </label>
          <label>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal notes"
            />
          </label>
          <label>
            Appeal note
            <textarea
              value={appealNote}
              onChange={(e) => setAppealNote(e.target.value)}
              placeholder="Optional player appeal / response captured by ops"
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={() => void onBan()}
          >
            Ban
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh list
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="ban-lookup-title">
        <h2 id="ban-lookup-title">Lookup</h2>
        <div className="grid two">
          <label>
            UID / ban id
            <input
              value={lookupUid}
              onChange={(e) => setLookupUid(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            IPv4
            <input
              value={lookupIpv4}
              onChange={(e) => setLookupIpv4(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            IPv6
            <input
              value={lookupIpv6}
              onChange={(e) => setLookupIpv6(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void onLookup()}
          >
            Check status
          </button>
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

      <section className="panel" aria-labelledby="ban-list-title">
        <h2 id="ban-list-title">Active bans</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">IPs</th>
                <th scope="col">Reason</th>
                <th scope="col">Identity</th>
                <th scope="col">Expires</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bans.length === 0 ? (
                <tr>
                  <td colSpan={6}>No active bans.</td>
                </tr>
              ) : (
                bans.map((ban) => (
                  <tr key={banKey(ban)}>
                    <td className="mono">{ban.banId || ban.uid || '—'}</td>
                    <td className="mono">{formatIps(ban)}</td>
                    <td>{ban.reason}</td>
                    <td>
                      {ban.anonymous ? (
                        <span className="badge anon">anonymous</span>
                      ) : (
                        ban.email ?? ban.displayName ?? '—'
                      )}
                    </td>
                    <td>{formatExpiry(ban)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        aria-label={`Unban ${banKey(ban)}`}
                        onClick={() => void onUnban(ban)}
                      >
                        Unban
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
