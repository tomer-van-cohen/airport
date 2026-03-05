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
 * Also watches for .spawn files written by the airport-spawn script.
 * These request creation of new terminal tabs from within existing sessions.
 *
 * Uses fs.watch on the status directory for near-instant detection (~ms),
 * with a slow polling fallback as a safety net for missed events.
 */
const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans');

export function startHookWatcher(
  ptyManager: PtyManager,
  getWindow: () => BrowserWindow | null
): () => void {
  const lastContent = new Map<string, string>();
  const lastPlanContent = new Map<string, string>();
  // Track known plan files (by path) so we can detect new ones
  const knownPlanPaths = new Set<string>();
  let plansInitialized = false;
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

  function processPlanFile(sessionId: string) {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;

    const statusFile = ptyManager.getStatusFile(sessionId);
    if (!statusFile) return;

    const planFile = statusFile.replace(/\.status$/, '.plan');
    let planPath: string;
    try {
      planPath = fs.readFileSync(planFile, 'utf-8').trim();
    } catch {
      return;
    }

    if (!planPath || planPath === lastPlanContent.get(sessionId)) return;
    lastPlanContent.set(sessionId, planPath);

    win.webContents.send(IPC.HOOK_PLAN, { sessionId, planPath });
  }

  // Guard against macOS fs.watch firing duplicate events for the same file
  const processedSpawns = new Set<string>();

  function processSpawnFile(filePath: string) {
    const basename = path.basename(filePath);
    if (processedSpawns.has(basename)) return;
    processedSpawns.add(basename);
    // Clean up after a short delay to avoid unbounded growth
    setTimeout(() => processedSpawns.delete(basename), 5000);

    const win = getWindow();
    if (!win || win.isDestroyed()) return;

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8').trim();
      fs.unlinkSync(filePath);
    } catch {
      return;
    }

    let request: { cwd?: string; command?: string; title?: string };
    try {
      request = JSON.parse(raw);
    } catch {
      return;
    }

    // Forward to renderer — it owns PTY + shadow terminal creation
    win.webContents.send(IPC.SPAWN_REQUEST, {
      title: request.title,
      cwd: request.cwd,
      command: request.command,
    });
  }

  // fs.watch on the directory: OS notifies us the moment any file changes
  let dirWatcher: fs.FSWatcher | undefined;
  try {
    dirWatcher = fs.watch(STATUS_DIR, (_event, filename) => {
      if (filename && filename.endsWith('.status')) {
        const sessionId = filename.slice(0, -7); // strip '.status'
        processSession(sessionId);
      } else if (filename && filename.endsWith('.plan')) {
        const sessionId = filename.slice(0, -5); // strip '.plan'
        processPlanFile(sessionId);
      } else if (filename && filename.endsWith('.spawn')) {
        processSpawnFile(path.join(STATUS_DIR, filename));
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

  // Poll ~/.claude/plans/ for new plan files created by Claude Code's plan mode.
  // Plan mode writes files internally (not via the Write tool), so the hook-based
  // detection alone won't catch them. This polling assigns new plans to busy sessions.
  function pollPlansDirectory() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(PLANS_DIR, { withFileTypes: true });
    } catch {
      return;
    }

    // On first run, just seed the known set without assigning
    if (!plansInitialized) {
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          knownPlanPaths.add(path.join(PLANS_DIR, entry.name));
        }
      }
      plansInitialized = true;
      return;
    }

    // Find newly appeared plan files
    const newFiles: { path: string; mtimeMs: number }[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = path.join(PLANS_DIR, entry.name);
      if (!knownPlanPaths.has(filePath)) {
        knownPlanPaths.add(filePath);
        try {
          const stat = fs.statSync(filePath);
          newFiles.push({ path: filePath, mtimeMs: stat.mtimeMs });
        } catch { /* ignore */ }
      }
    }

    if (newFiles.length === 0) return;

    // Sort newest first
    newFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

    // Assign each new file to a busy session that doesn't already have a plan
    const allSessions = ptyManager.getAllSessionIds();
    for (const file of newFiles) {
      // Find a busy session without an assigned plan
      const candidate = allSessions.find((sid) => {
        // Check if session is busy
        const statusFile = ptyManager.getStatusFile(sid);
        if (!statusFile) return false;
        try {
          const content = fs.readFileSync(statusFile, 'utf-8').trim();
          if (!content.startsWith('busy;')) return false;
        } catch {
          return false;
        }
        // Check if session already has a plan
        return !lastPlanContent.has(sid);
      });

      if (candidate) {
        lastPlanContent.set(candidate, file.path);
        win.webContents.send(IPC.HOOK_PLAN, { sessionId: candidate, planPath: file.path });
      }
    }
  }

  // Slow polling fallback — catches anything fs.watch might miss
  const interval = setInterval(() => {
    for (const sessionId of ptyManager.getAllSessionIds()) {
      processSession(sessionId);
      processPlanFile(sessionId);
    }
    pollPlansDirectory();
  }, 2000);

  return () => {
    clearInterval(interval);
    dirWatcher?.close();
    lastContent.clear();
    lastPlanContent.clear();
  };
}
