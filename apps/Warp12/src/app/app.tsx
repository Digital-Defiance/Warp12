import { useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

import { BridgeFocusProvider, useBridgeFocus } from './bridge-focus-context';
import {
  BridgeHeaderActionsProvider,
  useBridgeHeaderActions,
} from './bridge-header-actions-context';
import { GameAudioProvider } from './game-audio-context';
import { preservesGameSession } from './game-route';
import { LocalGamePage } from './local-game-page';
import { HomePage } from './home-page';
import { OnlineGamePage } from './online-game-page';
import { OnlineLobbyPage } from './online-lobby-page';
import { PrivacyDialog } from './privacy-dialog';
import { PrivacyPage } from './privacy-page';
import { RulesDialog } from './rules-dialog';
import { RulesPage } from './rules-page';
import styles from './app.module.scss';
import { Warp12Logo } from './Warp12Logo';

function AppShell() {
  const { focus } = useBridgeFocus();
  const { actions: headerActions, invokeAction } = useBridgeHeaderActions();
  const location = useLocation();
  const overlayDocs = preservesGameSession(location.pathname);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <div
      className={`${styles.shell} ${focus ? styles.shellFocus : ''}`}
      style={{
        ['--warp-void' as string]: '#050816',
        ['--warp-text' as string]: '#e2e8f0',
        ['--warp-text-muted' as string]: '#94a3b8',
        ['--warp-accent' as string]: '#38bdf8',
        ['--warp-panel-border' as string]: '#334155',
      }}
    >
      <header className={`${styles.header} ${focus ? styles.headerFocus : ''}`}>
        <div className={styles.headerStart}>
          <Link to="/" className={styles.logo}>
            <div>
              <Warp12Logo className={styles.logoSvg} width={focus ? 180 : 320} />
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
        </div>
        <nav className={styles.nav}>
          {overlayDocs ? (
            <>
              <button
                type="button"
                className={styles.navLink}
                onClick={() => setRulesOpen(true)}
              >
                Rules
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
              <Link to="/rules" className={styles.navLink}>
                Rules
              </Link>
              <Link to="/privacy" className={styles.navLink}>
                Privacy
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className={`${styles.main} ${focus ? styles.mainFocus : ''}`}>
        <div className={focus ? styles.mainStage : undefined}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/local" element={<LocalGamePage />} />
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
          <AppShell />
        </BridgeHeaderActionsProvider>
      </BridgeFocusProvider>
    </GameAudioProvider>
  );
}

export default App;
