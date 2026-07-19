import { useCallback, useEffect, useState } from 'react';
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
import { LayoutTierProvider, useLayoutTier, useLayoutTierState } from './layout-tier-context';
import { preservesGameSession } from './game-route';
import { AboutPage } from './about-page';
import { LocalGamePage } from './local-game-page';
import { PassAndPlayPage } from './pass-and-play-page';
import { HomePage } from './home-page';
import { OnlineGamePage } from './online-game-page';
import { OnlineLobbyPage } from './online-lobby-page';
import { OnlineWatchPage } from './online-watch-page';
import { PaperPage } from './paper-page';
import { ProfilePage } from './profile-page';
import { PrivacyDialog } from './privacy-dialog';
import { PrivacyPage } from './privacy-page';
import { ResearchDialog } from './research-dialog';
import { ResearchPage } from './research-page';
import { RulesDialog } from './rules-dialog';
import { RulesPage } from './rules-page';
import { TeiPage } from './tei-page';
import { ModulesPage } from './modules-page';
import { AdminStatusStrip } from './admin-status-strip';
import styles from './app.module.scss';
import { Warp12Logo } from './Warp12Logo';
import { FactorLanding } from './factor-landing';
import { HubHarnessPage } from './hub-harness-page';
import { getWarpFactor } from './warp-factor';
import { LiveAnnouncerProvider } from '../a11y/live-announcer';
import {
  shouldShowNativeSplash,
  SplashScreen,
  SPLASH_REPLAY_EVENT,
} from './splash-screen';

const warpFactor = getWarpFactor();

function AppShell() {
  const auth = useFirebaseAuth();
  useOfflineMatchSync(auth.user?.uid);
  const layoutTier = useLayoutTier();
  const { orientation } = useLayoutTierState();
  const { focus, tableSessionActive } = useBridgeFocus();
  const layoutFocus = focus && tableSessionActive;
  const { actions: headerActions, invokeAction } = useBridgeHeaderActions();
  const { headerStatus } = useBridgeHeaderStatus();
  const location = useLocation();
  const overlayDocs = preservesGameSession(location.pathname);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(shouldShowNativeSplash);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    const onReplay = () => setShowSplash(true);
    window.addEventListener(SPLASH_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(SPLASH_REPLAY_EVENT, onReplay);
  }, []);

  return (
    <div
      className={`${styles.shell} ${layoutFocus ? styles.shellFocus : ''}`}
      data-layout-tier={layoutTier}
      data-orientation={orientation}
      style={{
        ['--warp-void' as string]: '#050816',
        ['--warp-text' as string]: '#e2e8f0',
        ['--warp-text-muted' as string]: '#94a3b8',
        ['--warp-accent' as string]: '#38bdf8',
        ['--warp-panel-border' as string]: '#334155',
      }}
    >
      {showSplash ? <SplashScreen onFinished={finishSplash} /> : null}
      <AdminStatusStrip />
      <header
        className={`${styles.header} ${layoutFocus ? styles.headerFocus : ''}`}
        data-has-game-actions={headerActions.length > 0 ? 'true' : 'false'}
      >
        <div className={styles.headerStart}>
          <Link to="/" className={styles.logo}>
            <div>
              <Warp12Logo className={styles.logoSvg} width={layoutFocus ? 180 : 320} factor={warpFactor} />
              <p className={styles.subtitle}>The Bridge — Navigational Operations</p>
            </div>
          </Link>
        </div>
        {headerActions.length > 0 ? (
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
        ) : null}
        {headerStatus?.ratingLabel ? (
          <div
            className={styles.headerRating}
            role="status"
            data-rating={headerStatus.ratingState}
          >
            {headerStatus.ratingLabel}
          </div>
        ) : (
          <div className={styles.headerRatingSpacer} aria-hidden="true" />
        )}
        <div className={styles.headerEnd}>
          {headerStatus &&
            (headerStatus.sectorLabel || headerStatus.connectionLabel) && (
              <div className={styles.headerStatus} role="status">
                {headerStatus.sectorLabel ? (
                  <span className={styles.headerSector}>
                    {headerStatus.sectorLabel}
                  </span>
                ) : null}
                {headerStatus.connectionLabel ? (
                  <span
                    className={styles.headerConnection}
                    data-connection={headerStatus.connectionState}
                  >
                    {headerStatus.connectionLabel}
                  </span>
                ) : null}
              </div>
            )}
          <nav className={styles.nav} aria-label="Site">
            {/* Phone + table focus: Rules/Options live in game actions — keep IWDF only. */}
            {layoutTier === 'phone' && layoutFocus ? (
              <Link
                to="https://iwdf.org"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.iwdfLink}
              >
                IWDF
              </Link>
            ) : overlayDocs ? (
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
                  onClick={() => setResearchOpen(true)}
                >
                  Research
                </button>
                <button
                  type="button"
                  className={styles.navLink}
                  onClick={() => setPrivacyOpen(true)}
                >
                  Privacy
                </button>
                <Link
                  to="https://iwdf.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.iwdfLink}
                >
                  IWDF
                </Link>
              </>
            ) : (
              <>
                <Link to="/about" className={styles.navLink}>
                  About
                </Link>
                <Link to="/modules" className={styles.navLink}>
                  Modules
                </Link>
                {layoutTier !== 'phone' && (
                  <Link to="/research" className={styles.navLink}>
                    Research
                  </Link>
                )}
                <Link to="/rules" className={styles.navLink}>
                  Manual
                </Link>
                <Link to="/privacy" className={styles.navLink}>
                  Privacy
                </Link>
                <Link to="/profile" className={styles.navLink}>
                  Profile
                </Link>
                <Link
                  to="https://iwdf.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.iwdfLink}
                >
                  IWDF
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className={`${styles.main} ${layoutFocus ? styles.mainFocus : ''}`}>
        <div className={layoutFocus ? styles.mainStage : undefined}>
          <Routes>
            <Route path="/" element={<HomePage factor={warpFactor} />} />
            <Route path="/factor" element={<FactorLanding />} />
            <Route path="/harness/hub" element={<HubHarnessPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/modules" element={<ModulesPage />} />
            <Route path="/paper" element={<PaperPage />} />
            <Route path="/paper/log" element={<PaperPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/tei" element={<TeiPage />} />
            <Route path="/local" element={<LocalGamePage />} />
            <Route path="/local/pass-and-play" element={<PassAndPlayPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/online" element={<OnlineLobbyPage />} />
            <Route path="/online/:gameId" element={<OnlineLobbyPage />} />
            <Route path="/online/:gameId/play" element={<OnlineGamePage />} />
            <Route path="/online/:gameId/watch" element={<OnlineWatchPage />} />
          </Routes>
        </div>
      </main>

      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ResearchDialog open={researchOpen} onClose={() => setResearchOpen(false)} />
      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}

export function App() {
  return (
    <LiveAnnouncerProvider>
      <LayoutTierProvider>
        <GameAudioProvider>
          <BridgeFocusProvider>
            <BridgeHeaderActionsProvider>
              <BridgeHeaderStatusProvider>
                <AppShell />
              </BridgeHeaderStatusProvider>
            </BridgeHeaderActionsProvider>
          </BridgeFocusProvider>
        </GameAudioProvider>
      </LayoutTierProvider>
    </LiveAnnouncerProvider>
  );
}

export default App;
