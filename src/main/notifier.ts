import { Notification, app, BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../shared/ipc-channels';

// Track per-session previous hook state
const prevStates = new Map<string, 'busy' | 'done'>();
let activeSessionId: string | null = null;

export function initNotifier(getWindow: () => BrowserWindow | null): void {
  // Listen for active session changes from renderer
  ipcMain.on(IPC.ACTIVE_SESSION_CHANGED, (_event, sessionId: string) => {
    activeSessionId = sessionId;
    updateBadge();
  });
}

export function handleHookStatus(
  sessionId: string,
  state: 'busy' | 'done',
  message: string,
  getWindow: () => BrowserWindow | null
): void {
  const prev = prevStates.get(sessionId);
  prevStates.set(sessionId, state);

  // Update badge count
  updateBadge();

  // Only notify on busy -> done transition
  if (prev !== 'busy' || state !== 'done') return;

  const win = getWindow();

  // Suppress if window is focused AND this is the active session
  if (win && !win.isDestroyed() && win.isFocused() && sessionId === activeSessionId) return;

  // Fire notification
  const title = message ? 'Agent needs input' : 'Agent finished';
  const body = message || 'Session is waiting for your next instructions';

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on('click', () => {
    const w = getWindow();
    if (w && !w.isDestroyed()) {
      w.show();
      w.focus();
      w.webContents.send(IPC.NOTIFICATION_CLICK, sessionId);
    }
  });

  notification.show();
}

export function clearSession(sessionId: string): void {
  prevStates.delete(sessionId);
  updateBadge();
}

function updateBadge(): void {
  let count = 0;
  for (const [sid, st] of prevStates) {
    if (st === 'done' && sid !== activeSessionId) count++;
  }
  app.setBadgeCount(count);
}
