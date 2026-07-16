import { isTauriDesktop } from '../firebase/platform.js';

/**
 * Close the native Tauri window (ends the app when it's the last window).
 * No-op outside the desktop Tauri runtime.
 */
export async function quitTauriApp(): Promise<void> {
  if (!isTauriDesktop()) {
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}
