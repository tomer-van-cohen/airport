import { ipcMain, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { PtyManager } from './pty-manager';
import { IPC } from '../shared/ipc-channels';
import { PtyCreateOptions, SessionInfo, SavedState, ExternalTerminal } from '../shared/types';
import { saveState, loadState } from './state-manager';

const execFileAsync = promisify(execFile);

/**
 * Walk the process tree from `pid` down to its deepest descendant.
 * In a PTY the chain is typically: zsh → claude → node → …
 * The deepest child's cwd reflects the actual working directory
 * (e.g. a git worktree), not the shell's original cwd.
 */
async function getDeepestDescendant(pid: number): Promise<number> {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-P', String(pid)]);
    const children = stdout.trim().split('\n').filter(Boolean).map(Number);
    if (children.length === 0) return pid;
    return getDeepestDescendant(children[0]);
  } catch {
    return pid; // no children — this is the leaf
  }
}

export function registerIpcHandlers(ptyManager: PtyManager, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.PTY_CREATE, (_event, options: PtyCreateOptions) => {
    return ptyManager.create(
      options,
      (sessionId, data) => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC.PTY_DATA, { sessionId, data });
        }
      },
      (sessionId, exitCode) => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC.PTY_EXIT, { sessionId, exitCode });
        }
      }
    );
  });

  ipcMain.on(IPC.PTY_WRITE, (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data);
  });

  ipcMain.on(IPC.PTY_RESIZE, (_event, sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows);
  });

  ipcMain.on(IPC.PTY_CLOSE, (_event, sessionId: string) => {
    ptyManager.close(sessionId);
  });

  ipcMain.handle(IPC.PTY_GET_PROCESS_NAME, (_event, sessionId: string) => {
    return ptyManager.getProcessName(sessionId);
  });

  ipcMain.handle(IPC.GET_SESSION_INFO, async (_event, sessionId: string): Promise<SessionInfo> => {
    const pid = ptyManager.getPid(sessionId);
    if (!pid) return { cwd: '', gitRepo: '', gitBranch: '' };

    // Walk down to the deepest child so we pick up the cwd of the
    // actual foreground process (e.g. claude running in a worktree),
    // not the shell that Airport spawned.
    const fgPid = await getDeepestDescendant(pid);

    let cwd = '';
    try {
      const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(fgPid), '-d', 'cwd', '-Fn']);
      const match = stdout.match(/\nn(.*)/);
      if (match) cwd = match[1];
    } catch { /* ignore */ }

    if (!cwd) return { cwd: '', gitRepo: '', gitBranch: '' };

    let gitRepo = '';
    let gitBranch = '';
    try {
      // --git-common-dir returns the main repo's .git dir even inside a worktree
      // (relative ".git" in a normal repo, absolute path in a worktree)
      const { stdout: commonDir } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], { cwd });
      gitRepo = path.basename(path.dirname(path.resolve(cwd, commonDir.trim())));
      const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
      gitBranch = branch.trim();
    } catch { /* not a git repo */ }

    return { cwd, gitRepo, gitBranch };
  });

  ipcMain.handle(IPC.DISCOVER_TERMINALS, async (): Promise<ExternalTerminal[]> => {
    const ownPids = new Set(ptyManager.getOwnPids());
    const shellNames = new Set(['zsh', 'bash', 'fish', 'sh', 'tcsh', 'ksh']);

    let psOutput: string;
    try {
      const { stdout } = await execFileAsync('ps', ['-eo', 'pid,tty,comm']);
      psOutput = stdout;
    } catch {
      return [];
    }

    const candidates: Array<{ pid: number; tty: string; shell: string }> = [];
    for (const line of psOutput.trim().split('\n').slice(1)) {
      const match = line.trim().match(/^(\d+)\s+(\S+)\s+(.+)$/);
      if (!match) continue;

      const pid = parseInt(match[1], 10);
      const tty = match[2];
      const comm = match[3];

      if (tty === '??' || tty === '-') continue;

      const baseName = comm.split('/').pop()?.replace(/^-/, '') || '';
      if (!shellNames.has(baseName)) continue;
      if (ownPids.has(pid)) continue;

      candidates.push({ pid, tty, shell: baseName });
    }

    const results: ExternalTerminal[] = [];
    for (const candidate of candidates) {
      try {
        const { stdout } = await execFileAsync('lsof', [
          '-a', '-p', String(candidate.pid), '-d', 'cwd', '-Fn',
        ]);
        const cwdMatch = stdout.match(/\nn(.*)/);
        if (cwdMatch && cwdMatch[1]) {
          results.push({
            pid: candidate.pid,
            tty: candidate.tty,
            shell: candidate.shell,
            cwd: cwdMatch[1],
          });
        }
      } catch {
        // Skip processes we cannot inspect
      }
    }

    // Deduplicate by CWD
    const seen = new Set<string>();
    return results.filter((t) => {
      if (seen.has(t.cwd)) return false;
      seen.add(t.cwd);
      return true;
    });
  });

  ipcMain.handle(IPC.STATE_SAVE, (_event, state: SavedState) => {
    saveState(state);
  });

  ipcMain.handle(IPC.STATE_LOAD, () => {
    return loadState();
  });
}
