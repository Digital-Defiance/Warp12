import { useCallback, useEffect, useState } from 'react';

import { useOpsAuth } from '../firebase/ops-auth';
import {
  formatBytes,
  listTtsCache,
  purgeTtsCache,
  type TtsCacheObjectSummary,
  type TtsMatchFolderSummary,
} from '../firebase/tts-cache-service';

function fmtWhen(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * Admin tool for Firebase Storage commentator TTS cache
 * (`tts-cache/matches/{matchId}/*.mp3`).
 */
export function TtsCachePanel() {
  const { isAdmin } = useOpsAuth();
  const [matchFilter, setMatchFilter] = useState('');
  const [folders, setFolders] = useState<TtsMatchFolderSummary[]>([]);
  const [objects, setObjects] = useState<TtsCacheObjectSummary[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [approxTotal, setApproxTotal] = useState<number | null>(null);
  const [approxBytes, setApproxBytes] = useState<number | null>(null);
  const [truncatedAt, setTruncatedAt] = useState(2000);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (pageToken?: string, append = false) => {
      if (!isAdmin) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const scoped = matchFilter.trim() || undefined;
        const res = await listTtsCache({
          pageSize: 50,
          pageToken,
          matchId: scoped,
        });
        setObjects((prev) =>
          append ? [...prev, ...res.objects] : [...res.objects]
        );
        setNextPageToken(res.nextPageToken);
        if (!append) {
          setFolders([...res.matchFolders]);
          setApproxTotal(res.approxTotal);
          setApproxBytes(res.approxBytes);
          setTruncatedAt(res.truncatedAt);
          setSelected(new Set());
        }
        setStatus(
          `Loaded ${append ? 'more' : res.objects.length} object${
            res.objects.length === 1 ? '' : 's'
          }${
            scoped ? ` for match ${scoped}` : ''
          }${
            res.approxTotal != null
              ? ` · ~${res.approxTotal}${
                  res.approxTotal >= res.truncatedAt ? '+' : ''
                } clips (${formatBytes(res.approxBytes ?? 0)})`
              : ''
          }.`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to list TTS cache.');
      } finally {
        setBusy(false);
      }
    },
    [isAdmin, matchFilter]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      if (prev.size === objects.length) {
        return new Set();
      }
      return new Set(objects.map((o) => o.name));
    });
  };

  const onPurgeSelected = async () => {
    if (!isAdmin || selected.size === 0) {
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reason is required to purge cache objects.');
      return;
    }
    if (
      !window.confirm(
        `Delete ${selected.size} cached MP3${selected.size === 1 ? '' : 's'}?`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await purgeTtsCache({
        names: [...selected],
        reason: trimmed,
      });
      setStatus(`Deleted ${res.deleted} of ${res.requested}.`);
      if (res.errors.length) {
        setError(res.errors.slice(0, 5).join('; '));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purge failed.');
    } finally {
      setBusy(false);
    }
  };

  const onPurgeMatch = async (matchId: string) => {
    if (!isAdmin) {
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reason is required to purge a match folder.');
      return;
    }
    if (
      !window.confirm(
        `Delete all TTS clips for match ${matchId}? They will regenerate on next speak.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await purgeTtsCache({ matchId, reason: trimmed });
      setStatus(
        `Purged match ${matchId}: ${res.deleted} object${res.deleted === 1 ? '' : 's'}.`
      );
      if (res.errors.length) {
        setError(res.errors.slice(0, 5).join('; '));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Match purge failed.');
    } finally {
      setBusy(false);
    }
  };

  const onPurgeAll = async () => {
    if (!isAdmin) {
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reason is required to purge the entire TTS cache.');
      return;
    }
    if (
      !window.confirm(
        'Purge the entire tts-cache/ tree (all matches)? This cannot be undone.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await purgeTtsCache({ purgeAll: true, reason: trimmed });
      setStatus(`Purged ${res.deleted} object${res.deleted === 1 ? '' : 's'}.`);
      if (res.errors.length) {
        setError(res.errors.slice(0, 5).join('; '));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purge-all failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="panel">
        <h2>TTS cache</h2>
        <p style={{ color: 'var(--muted)' }}>Admin role required.</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel" aria-labelledby="tts-cache-title">
        <h2 id="tts-cache-title">Commentator TTS cache</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Firebase Storage under <code>tts-cache/matches/&#123;matchId&#125;/</code>
          — one folder per sector/local match, plus metadata tags (
          <code>matchId</code>, <code>sectorCode</code>, voice/model). Purges are
          audited.
        </p>
        <div className="grid two">
          <label>
            Match id filter
            <input
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value)}
              placeholder="e.g. online-ABCD12 or local-…"
              className="mono"
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh
          </button>
          {matchFilter.trim() ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setMatchFilter('');
              }}
            >
              Clear filter
            </button>
          ) : null}
          {nextPageToken ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void load(nextPageToken, true)}
            >
              Load more
            </button>
          ) : null}
        </div>
        {approxTotal != null ? (
          <p role="status" style={{ fontSize: '0.85rem' }}>
            Approx. {approxTotal}
            {approxTotal >= truncatedAt ? '+' : ''} clips ·{' '}
            {formatBytes(approxBytes ?? 0)}
          </p>
        ) : null}
        {status ? (
          <div className="msg" role="status">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="msg error" role="alert">
            {error}
          </div>
        ) : null}
      </section>

      {!matchFilter.trim() && folders.length > 0 ? (
        <section className="panel" aria-labelledby="tts-matches-title">
          <h2 id="tts-matches-title">Matches</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Match id</th>
                  <th scope="col">Sector</th>
                  <th scope="col">Clips</th>
                  <th scope="col">Size</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr key={folder.matchId}>
                    <td className="mono">{folder.matchId}</td>
                    <td className="mono">{folder.sectorCode ?? '—'}</td>
                    <td>{folder.objectCount}</td>
                    <td>{formatBytes(folder.sizeBytes)}</td>
                    <td>{fmtWhen(folder.updatedAt)}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => setMatchFilter(folder.matchId)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void onPurgeMatch(folder.matchId)}
                        >
                          Purge match
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel" aria-labelledby="tts-cache-actions-title">
        <h2 id="tts-cache-actions-title">Purge</h2>
        <label>
          Reason (required)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. clear stale voice after model change"
            maxLength={200}
          />
        </label>
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy || selected.size === 0}
            onClick={() => void onPurgeSelected()}
          >
            Delete selected ({selected.size})
          </button>
          {matchFilter.trim() ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onPurgeMatch(matchFilter.trim())}
            >
              Purge this match folder
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void onPurgeAll()}
          >
            Purge entire cache
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="tts-cache-list-title">
        <h2 id="tts-cache-list-title">Objects</h2>
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy || objects.length === 0}
            onClick={toggleAllVisible}
          >
            {selected.size === objects.length && objects.length > 0
              ? 'Clear selection'
              : 'Select visible'}
          </button>
        </div>
        {objects.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No cached MP3s loaded — empty until audible commentary runs for a
            match.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col">Match</th>
                  <th scope="col">Sector</th>
                  <th scope="col">Cache key</th>
                  <th scope="col">Size</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((obj) => (
                  <tr key={obj.name}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(obj.name)}
                        onChange={() => toggle(obj.name)}
                        aria-label={`Select ${obj.cacheKey}`}
                      />
                    </td>
                    <td className="mono">{obj.matchId ?? '—'}</td>
                    <td className="mono">{obj.sectorCode ?? '—'}</td>
                    <td className="mono" title={obj.name}>
                      {obj.cacheKey.slice(0, 12)}…
                    </td>
                    <td>{formatBytes(obj.sizeBytes)}</td>
                    <td>{fmtWhen(obj.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
