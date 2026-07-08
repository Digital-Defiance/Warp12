import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

/** Tauri (desktop + mobile) uses hash routing; the web app keeps history routing. */
export function AppRouter({ children }: { children: ReactNode }) {
  const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);
  if (isTauri) {
    return <HashRouter future={routerFutureFlags}>{children}</HashRouter>;
  }
  return <BrowserRouter future={routerFutureFlags}>{children}</BrowserRouter>;
}
