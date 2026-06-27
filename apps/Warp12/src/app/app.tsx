import { Link, Route, Routes } from 'react-router-dom';

import { BridgeFocusProvider, useBridgeFocus } from './bridge-focus-context';
import { LocalGamePage } from './local-game-page';
import { HomePage } from './home-page';
import { OnlineGamePage } from './online-game-page';
import { OnlineLobbyPage } from './online-lobby-page';
import { RulesPage } from './rules-page';
import styles from './app.module.scss';
import { Warp12Logo } from './Warp12Logo';

function AppShell() {
  const { focus } = useBridgeFocus();

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
        <Link to="/" className={styles.logo}>
          <div>
            <Warp12Logo className={styles.logoSvg} width={focus ? 180 : 320} />
            <p className={styles.subtitle}>The Bridge — Navigational Operations</p>
          </div>
        </Link>
        <nav className={styles.nav}>
          <Link to="/rules" className={styles.navLink}>
            Rules
          </Link>
        </nav>
      </header>

      <main className={`${styles.main} ${focus ? styles.mainFocus : ''}`}>
        <div className={focus ? styles.mainStage : undefined}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/local" element={<LocalGamePage />} />
            <Route path="/online" element={<OnlineLobbyPage />} />
            <Route path="/online/:gameId" element={<OnlineLobbyPage />} />
            <Route path="/online/:gameId/play" element={<OnlineGamePage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <BridgeFocusProvider>
      <AppShell />
    </BridgeFocusProvider>
  );
}

export default App;
