import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';

/** Tauri (desktop + mobile) uses hash routing; the web app keeps history routing. */
export function AppRouter({ children }: { children: ReactNode }) {
  const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);
  if (isTauri) {
    return <HashRouter>{children}</HashRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}
