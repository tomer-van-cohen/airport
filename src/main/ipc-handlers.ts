import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { PtyManager } from './pty-manager';
import { WsServer } from './ws-server';
import { IPC } from '../shared/ipc-channels';
import { PtyCreateOptions, SessionInfo, SavedState, ExternalTerminal, PlanFile } from '../shared/types';
import { saveState, loadState } from './state-manager';

const execFileAsync = promisify(execFile);

/**
 * Walk the process tree from `pid` down to its deepest descendant.
 * In a PTY the chain is typically: zsh → claude → node → …
 * The deepest child's cwd reflects the actual working directory
 * (e.g. a git worktree), not the shell's original cwd.
 */
async function getDeepestDescendant(pid: number): Promise<number> {
  if (process.platform === 'win32') return getDeepestDescendantWindows(pid);
  try {
    const { stdout } = await execFileAsync('pgrep', ['-P', String(pid)]);
    const children = stdout.trim().split('\n').filter(Boolean).map(Number);
    if (children.length === 0) return pid;
    return getDeepestDescendant(children[0]);
  } catch {
    return pid;
  }
}

async function getDeepestDescendantWindows(pid: number): Promise<number> {
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-Command',
      `(Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}").ProcessId`
    ]);
    const children = stdout.trim().split('\n')
      .map(l => parseInt(l.trim(), 10))
      .filter(n => !isNaN(n));
    if (children.length === 0) return pid;
    return getDeepestDescendantWindows(children[0]);
  } catch { return pid; }
}

export function registerIpcHandlers(ptyManager: PtyManager, server: WsServer): void {
  server.handle(IPC.PTY_CREATE, (options: PtyCreateOptions) => {
    return ptyManager.create(
      options,
      (sessionId, data) => {
        server.broadcast(IPC.PTY_DATA, { sessionId, data });
      },
      (sessionId, exitCode) => {
        server.broadcast(IPC.PTY_EXIT, { sessionId, exitCode });
      }
    );
  });

  server.on(IPC.PTY_WRITE, (sessionId: string, data: string) => {
    ptyManager.write(sessionId, data);
  });

  server.on(IPC.PTY_RESIZE, (sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows);
  });

  server.on(IPC.PTY_CLOSE, (sessionId: string) => {
    ptyManager.close(sessionId);
  });

  server.handle(IPC.PTY_GET_PROCESS_NAME, (sessionId: string) => {
    return ptyManager.getProcessName(sessionId);
  });

  server.handle(IPC.GET_SESSION_INFO, async (sessionId: string): Promise<SessionInfo> => {
    const pid = ptyManager.getPid(sessionId);
    if (!pid) return { cwd: '', gitRepo: '', gitBranch: '' };

    // Walk down to the deepest child so we pick up the cwd of the
    // actual foreground process (e.g. claude running in a worktree),
    // not the shell that Airport spawned.
    const fgPid = await getDeepestDescendant(pid);

    let cwd = '';
    if (process.platform === 'win32') {
      const statusFile = ptyManager.getStatusFile(sessionId);
      if (statusFile) {
        const cwdFile = path.join(path.dirname(statusFile), `${sessionId}.cwd`);
        try { cwd = fs.readFileSync(cwdFile, 'utf-8').trim(); } catch {}
      }
    } else {
      try {
        const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(fgPid), '-d', 'cwd', '-Fn']);
        const match = stdout.match(/\nn(.*)/);
        if (match) cwd = match[1];
      } catch { /* ignore */ }
    }

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

  server.handle(IPC.DISCOVER_TERMINALS, async (): Promise<ExternalTerminal[]> => {
    if (process.platform === 'win32') return [];
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

  server.handle(IPC.PLAN_GET_FILES, async (_cwd: string): Promise<PlanFile[]> => {
    // Claude Code stores all plans globally in ~/.claude/plans/.
    // Return all plan files so the renderer can track which are new.
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (!home) return [];
    const plansDir = path.join(home, '.claude', 'plans');

    try {
      const entries = await fs.promises.readdir(plansDir, { withFileTypes: true });
      const files: PlanFile[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const filePath = path.join(plansDir, entry.name);
        const stat = await fs.promises.stat(filePath);
        files.push({ name: entry.name, path: filePath, modifiedAt: stat.mtimeMs });
      }
      return files;
    } catch {
      return [];
    }
  });

  server.handle(IPC.PLAN_READ_FILE, async (filePath: string): Promise<string> => {
    if (!filePath.includes('.claude/plans/') && !filePath.includes('.claude\\plans\\')) return '';
    if (!filePath.endsWith('.md')) return '';
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  });

  server.handle(IPC.STATE_SAVE, (state: SavedState) => {
    saveState(state);
  });

  server.handle(IPC.STATE_LOAD, () => {
    return loadState();
  });
}
