import { useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

import { useOfflineMatchSync } from '../firebase/use-offline-match-sync.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';

import { BridgeFocusProvider, useBridgeFocus } from './bridge-focus-context';
import {
  BridgeHeaderActionsProvider,
  useBridgeHeaderActions,
} from './bridge-header-actions-context';
import {
  BridgeHeaderStatusProvider,
  useBridgeHeaderStatus,
} from './bridge-header-status-context';
import { GameAudioProvider } from './game-audio-context';
import { preservesGameSession } from './game-route';
import { AboutPage } from './about-page';
import { LocalGamePage } from './local-game-page';
import { PassAndPlayPage } from './pass-and-play-page';
import { HomePage } from './home-page';
import { OnlineGamePage } from './online-game-page';
import { OnlineLobbyPage } from './online-lobby-page';
import { PaperPage } from './paper-page';
import { ProfilePage } from './profile-page';
import { PrivacyDialog } from './privacy-dialog';
import { PrivacyPage } from './privacy-page';
import { RulesDialog } from './rules-dialog';
import { RulesPage } from './rules-page';
import styles from './app.module.scss';
import { Warp12Logo } from './Warp12Logo';

function AppShell() {
  const auth = useFirebaseAuth();
  useOfflineMatchSync(auth.user?.uid);
  const { focus, tableSessionActive } = useBridgeFocus();
  const layoutFocus = focus && tableSessionActive;
  const { actions: headerActions, invokeAction } = useBridgeHeaderActions();
  const { headerStatus } = useBridgeHeaderStatus();
  const location = useLocation();
  const overlayDocs = preservesGameSession(location.pathname);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <div
      className={`${styles.shell} ${layoutFocus ? styles.shellFocus : ''}`}
      style={{
        ['--warp-void' as string]: '#050816',
        ['--warp-text' as string]: '#e2e8f0',
        ['--warp-text-muted' as string]: '#94a3b8',
        ['--warp-accent' as string]: '#38bdf8',
        ['--warp-panel-border' as string]: '#334155',
      }}
    >
      <header className={`${styles.header} ${layoutFocus ? styles.headerFocus : ''}`}>
        <div className={styles.headerStart}>
          <Link to="/" className={styles.logo}>
            <div>
              <Warp12Logo className={styles.logoSvg} width={layoutFocus ? 180 : 320} />
              <p className={styles.subtitle}>The Bridge — Navigational Operations</p>
            </div>
          </Link>
          {headerActions.length > 0 && (
            <div className={styles.headerGameActions} aria-label="Game actions">
              {headerActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={styles.headerActionBtn}
                  onClick={() => invokeAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {headerStatus && (
            <div className={styles.headerStatus} role="status">
              {headerStatus.sectorLabel ? (
                <span className={styles.headerSector}>
                  {headerStatus.sectorLabel}
                </span>
              ) : null}
              <span
                className={styles.headerConnection}
                data-connection={headerStatus.connectionState}
              >
                {headerStatus.connectionLabel}
              </span>
            </div>
          )}
        </div>
        <nav className={styles.nav}>
          {overlayDocs ? (
            <>
              <button
                type="button"
                className={styles.navLink}
                onClick={() => setRulesOpen(true)}
              >
                Manual
              </button>
              <button
                type="button"
                className={styles.navLink}
                onClick={() => setPrivacyOpen(true)}
              >
                Privacy
              </button>
            </>
          ) : (
            <>
              <Link to="/about" className={styles.navLink}>
                About
              </Link>
              <Link to="https://docs.warp12.app/tei-paper-outline.html" className={styles.navLink}>
                Research
              </Link>
              <Link to="/rules" className={styles.navLink}>
                Manual
              </Link>
              <Link to="/privacy" className={styles.navLink}>
                Privacy
              </Link>
              <Link to="/profile" className={styles.navLink}>
                Profile
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className={`${styles.main} ${layoutFocus ? styles.mainFocus : ''}`}>
        <div className={layoutFocus ? styles.mainStage : undefined}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/paper" element={<PaperPage />} />
            <Route path="/paper/log" element={<PaperPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/local" element={<LocalGamePage />} />
            <Route path="/local/pass-and-play" element={<PassAndPlayPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/online" element={<OnlineLobbyPage />} />
            <Route path="/online/:gameId" element={<OnlineLobbyPage />} />
            <Route path="/online/:gameId/play" element={<OnlineGamePage />} />
          </Routes>
        </div>
      </main>

      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}

export function App() {
  return (
    <GameAudioProvider>
      <BridgeFocusProvider>
        <BridgeHeaderActionsProvider>
          <BridgeHeaderStatusProvider>
            <AppShell />
          </BridgeHeaderStatusProvider>
        </BridgeHeaderActionsProvider>
      </BridgeFocusProvider>
    </GameAudioProvider>
  );
}

export default App;
