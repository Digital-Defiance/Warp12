import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createGameLog,
  formatCommentatorLogLines,
  type GameLogEntry,
} from 'warp12-react';

import {
  subscribeOnlineGame,
  useFirebaseAuth,
} from '../firebase';
import { joinSpectate, leaveSpectate } from '../firebase/spectate-service.js';
import { formatDisplayTime, formatElapsedLogTime } from './display-time.js';
import { buildCaptainNameColors } from './game-log-display.js';
import {
  COMMENTATOR_OVERLAY_MAX_LINES,
  takeRecentLogLines,
} from './game-log-filter.js';
import { GameLogLine } from './game-log-line.js';
import styles from './commentary-overlay-page.module.scss';

const GALLERY_CLOSED_MESSAGE =
  'Spectator gallery is closed for this sector. Ask the host to reopen spectate, then reload this overlay.';

/**
 * Standalone OBS source for an online sector — does not need the play/watch
 * tab. Joins the spectator gallery so move-log security rules allow the feed.
 */
export function OnlineCommentaryPage() {
  const { gameId } = useParams();
  const code = (gameId ?? '').toUpperCase();
  const auth = useFirebaseAuth();
  const uid = auth.user?.uid ?? '';
  const [entries, setEntries] = useState<readonly GameLogEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<readonly string[]>([]);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [roundStartedAtMs, setRoundStartedAtMs] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.commentaryOverlay = 'true';
    document.body.dataset.commentaryOverlay = 'true';
    return () => {
      delete document.documentElement.dataset.commentaryOverlay;
      delete document.body.dataset.commentaryOverlay;
    };
  }, []);

  useEffect(() => {
    if (!code || !uid || !auth.ready) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await joinSpectate(code);
        if (!cancelled) {
          setJoined(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const raw =
            err instanceof Error ? err.message : 'Could not join commentary feed';
          const closed =
            /disabled spectators|spectat/i.test(raw) ||
            /gallery/i.test(raw);
          setError(closed ? GALLERY_CLOSED_MESSAGE : raw);
          setJoined(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      void leaveSpectate(code).catch(() => undefined);
    };
  }, [auth.ready, code, uid]);

  useEffect(() => {
    if (!code || !uid || !joined) {
      return;
    }
    const log = createGameLog();
    let lastRound = -1;
    let synced = 0;

    return subscribeOnlineGame(
      code,
      uid,
      (snapshot) => {
        if (snapshot.ejected) {
          setError(GALLERY_CLOSED_MESSAGE);
          setEntries([]);
          return;
        }
        const game = snapshot.state;
        if (!game) {
          return;
        }
        const round = game.round;
        const nameMap: Record<string, string> = {};
        for (const captain of snapshot.sectorCaptains) {
          nameMap[captain.id] = captain.displayName;
        }
        for (const captain of game.captains) {
          if (!nameMap[captain.id]) {
            nameMap[captain.id] = captain.displayName;
          }
        }
        setNames(nameMap);
        setOrder(
          round?.turnOrder ?? game.captains.map((captain) => captain.id)
        );
        setError(null);

        if (!round) {
          log.clear();
          synced = 0;
          lastRound = -1;
          setEntries([]);
          setRoundNumber(null);
          return;
        }

        if (round.roundNumber !== lastRound) {
          log.clear();
          synced = 0;
          lastRound = round.roundNumber;
          setRoundStartedAtMs(Date.now());
          setRoundNumber(round.roundNumber);
        }

        const moveLog = snapshot.moveLog;
        if (moveLog.length < synced) {
          synced = 0;
          log.clear();
        }
        for (let i = synced; i < moveLog.length; i += 1) {
          const move = moveLog[i];
          if (move?.entry) {
            log.append(move.entry);
          }
          if (move?.autoAllStop) {
            log.append(move.autoAllStop);
          }
        }
        synced = moveLog.length;
        setEntries(log.snapshot());
      },
      (err) => {
        setError(err.message);
      },
      'spectate'
    );
  }, [code, joined, uid]);

  const lines = useMemo(() => {
    const formatted = formatCommentatorLogLines(entries, names, {
      roundStartedAtMs,
      formatElapsed: formatElapsedLogTime,
      formatAbsolute: formatDisplayTime,
    });
    return takeRecentLogLines(formatted, COMMENTATOR_OVERLAY_MAX_LINES);
  }, [entries, names, roundStartedAtMs]);

  const nameColors = useMemo(
    () => buildCaptainNameColors(names, order),
    [names, order]
  );

  const title =
    roundNumber != null ? `Round ${roundNumber} · ${code}` : code || 'Sector';

  return (
    <main className={styles.overlay} aria-live="polite" aria-relevant="additions">
      <h1 className={styles.srOnly}>Warp online commentary — {code}</h1>
      {error ? (
        <p className={styles.waiting} role="alert">
          {error}{' '}
          <Link to={code ? `/online/${code}` : '/online'}>Open sector lobby</Link>
        </p>
      ) : null}
      {!error && lines.length === 0 ? (
        <p className={styles.waiting} role="status">
          Commentary live for {code} — waiting for the first highlight…
        </p>
      ) : null}
      {!error ? <p className={styles.title}>{title}</p> : null}
      {!error ? (
        <div className={styles.feed}>
          {lines.map((line, index) => (
            <GameLogLine
              key={`${index}-${line}`}
              line={line}
              nameColors={nameColors}
              className={`${styles.line}${
                index === lines.length - 1 ? ` ${styles.lineLatest}` : ''
              }`}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
