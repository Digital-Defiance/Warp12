import { useState } from 'react';

import { AuditPanel } from './audit-panel';
import { BansPanel } from './bans-panel';
import { CaptainsPanel } from './captains-panel';
import { CrewsPanel } from './crews-panel';
import { ReportsPanel } from './reports-panel';
import { SectorsPanel } from './sectors-panel';
import { SubspacePanel } from './subspace-panel';
import { useOpsAuth } from '../firebase/ops-auth';

type OpsTab =
  | 'sectors'
  | 'captains'
  | 'subspace'
  | 'reports'
  | 'crews'
  | 'audit'
  | 'bans';

export function App() {
  const auth = useOpsAuth();
  const [tab, setTab] = useState<OpsTab>('sectors');

  if (!auth.ready) {
    return (
      <div className="shell">
        <main className="main">
          <p role="status">Loading Warp Ops…</p>
        </main>
      </div>
    );
  }

  if (!auth.configured) {
    return (
      <div className="shell">
        <main className="main">
          <div className="gate panel">
            <h2>Firebase not configured</h2>
            <p>
              Set <code>VITE_FIREBASE_*</code> in <code>apps/Warp12/.env</code>{' '}
              (shared with the Bridge).
            </p>
          </div>
        </main>
      </div>
    );
  }

  const roleLabel = auth.isAdmin
    ? 'admin'
    : auth.roles.includes('moderator')
      ? 'moderator'
      : 'ops';

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <img src="/W-1-1.png" alt="" width={36} height={36} />
          <div>
            <h1>Warp Ops</h1>
            <p>Fleet administration · warp-12</p>
          </div>
        </div>
        <div className="session">
          {auth.user && !auth.user.isAnonymous ? (
            <>
              <code>{auth.user.email ?? auth.user.uid}</code>
              {auth.isOps ? (
                <span className="badge" title="Auth custom claim">
                  {roleLabel}
                </span>
              ) : null}
              <button type="button" className="btn" onClick={() => void auth.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={() => void auth.signIn()}
            >
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {!auth.user || auth.user.isAnonymous ? (
          <div className="gate panel">
            <h2>Sign in required</h2>
            <p>
              Warp Ops is restricted to captains with the Firebase{' '}
              <strong>admin</strong> or <strong>moderator</strong> claim.
            </p>
            {auth.error ? (
              <div className="msg error" role="alert">
                {auth.error}
              </div>
            ) : null}
            <div className="actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => void auth.signIn()}
              >
                Sign in with Google
              </button>
            </div>
          </div>
        ) : auth.checkingAdmin ? (
          <p role="status">Checking ops claim…</p>
        ) : !auth.isOps ? (
          <div className="gate panel">
            <h2>Ops role required</h2>
            <p>
              Signed in as {auth.user.email ?? auth.user.uid}, but this account
              does not have the <code>admin</code> or <code>moderator</code>{' '}
              role.
            </p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn"
                onClick={() => void auth.refreshAdmin()}
              >
                Refresh claim
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void auth.signOut()}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <>
            <nav className="nav" aria-label="Ops sections">
              <button
                type="button"
                className="btn"
                aria-current={tab === 'sectors' ? 'page' : undefined}
                onClick={() => setTab('sectors')}
              >
                Sectors
              </button>
              <button
                type="button"
                className="btn"
                aria-current={tab === 'captains' ? 'page' : undefined}
                onClick={() => setTab('captains')}
              >
                Captains
              </button>
              <button
                type="button"
                className="btn"
                aria-current={tab === 'subspace' ? 'page' : undefined}
                onClick={() => setTab('subspace')}
              >
                Subspace
              </button>
              <button
                type="button"
                className="btn"
                aria-current={tab === 'reports' ? 'page' : undefined}
                onClick={() => setTab('reports')}
              >
                Reports
              </button>
              <button
                type="button"
                className="btn"
                aria-current={tab === 'crews' ? 'page' : undefined}
                onClick={() => setTab('crews')}
              >
                Crews
              </button>
              <button
                type="button"
                className="btn"
                aria-current={tab === 'audit' ? 'page' : undefined}
                onClick={() => setTab('audit')}
              >
                Audit
              </button>
              {auth.isAdmin ? (
                <button
                  type="button"
                  className="btn"
                  aria-current={tab === 'bans' ? 'page' : undefined}
                  onClick={() => setTab('bans')}
                >
                  Bans
                </button>
              ) : null}
            </nav>
            {tab === 'sectors' ? (
              <SectorsPanel />
            ) : tab === 'captains' ? (
              <CaptainsPanel />
            ) : tab === 'subspace' ? (
              <SubspacePanel />
            ) : tab === 'reports' ? (
              <ReportsPanel />
            ) : tab === 'crews' ? (
              <CrewsPanel />
            ) : tab === 'audit' ? (
              <AuditPanel />
            ) : auth.isAdmin ? (
              <BansPanel />
            ) : (
              <SectorsPanel />
            )}
          </>
        )}
      </main>
    </div>
  );
}
