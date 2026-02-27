import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BrowserWindow } from 'electron';
import { PtyManager } from './pty-manager';
import { IPC } from '../shared/ipc-channels';

/**
 * Watches status files written by Claude Code hooks.
 * Each PTY session has a file at /tmp/airport-{pid}/{sessionId}.status
 * Hook scripts write "busy;message" or "done;message" to these files.
 *
 * Uses fs.watch on the status directory for near-instant detection (~ms),
 * with a slow polling fallback as a safety net for missed events.
 */
export function startHookWatcher(
  ptyManager: PtyManager,
  getWindow: () => BrowserWindow | null
): () => void {
  const lastContent = new Map<string, string>();
  const STATUS_DIR = path.join(os.tmpdir(), `airport-${process.pid}`);

  function processSession(sessionId: string) {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;

    const filePath = ptyManager.getStatusFile(sessionId);
    if (!filePath) return;

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8').trim();
    } catch {
      return;
    }

    if (!content || content === lastContent.get(sessionId)) return;
    lastContent.set(sessionId, content);

    const semi = content.indexOf(';');
    const state = (semi >= 0 ? content.slice(0, semi) : content) as 'busy' | 'done';
    const message = semi >= 0 ? content.slice(semi + 1) : '';

    if (state === 'busy' || state === 'done') {
      win.webContents.send(IPC.HOOK_STATUS, { sessionId, state, message });
    }
  }

  // fs.watch on the directory: OS notifies us the moment any .status file changes
  let dirWatcher: fs.FSWatcher | undefined;
  try {
    dirWatcher = fs.watch(STATUS_DIR, (_event, filename) => {
      if (filename && filename.endsWith('.status')) {
        const sessionId = filename.slice(0, -7); // strip '.status'
        processSession(sessionId);
      } else {
        // filename can be null on some platforms — scan all sessions
        for (const sessionId of ptyManager.getAllSessionIds()) {
          processSession(sessionId);
        }
      }
    });
    dirWatcher.on('error', () => { /* ignore watch errors, polling covers it */ });
  } catch {
    // Directory watch unavailable, rely on polling only
  }

  // Slow polling fallback — catches anything fs.watch might miss
  const interval = setInterval(() => {
    for (const sessionId of ptyManager.getAllSessionIds()) {
      processSession(sessionId);
    }
  }, 2000);

  return () => {
    clearInterval(interval);
    dirWatcher?.close();
    lastContent.clear();
  };
}
