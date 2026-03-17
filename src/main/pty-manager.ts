import * as pty from 'node-pty';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PtyCreateOptions } from '../shared/types';

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    for (const shell of ['pwsh.exe', 'powershell.exe', 'cmd.exe']) {
      try { execFileSync('where', [shell], { stdio: 'ignore' }); return shell; }
      catch { /* not found */ }
    }
    return 'cmd.exe';
  }
  return process.env.SHELL || '/bin/zsh';
}

interface PtySession {
  process: pty.IPty;
  id: string;
  statusFile: string;
}

const STATUS_DIR = path.join(os.tmpdir(), `airport-${process.pid}`);
const BIN_DIR = process.env.AIRPORT_BIN_DIR || path.join(__dirname, '..', '..', 'bin');

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private nextId = 0;

  constructor() {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
  }

  create(
    options: PtyCreateOptions,
    onData: (sessionId: string, data: string) => void,
    onExit: (sessionId: string, exitCode: number) => void
  ): string {
    const id = `session-${this.nextId++}`;
    const statusFile = path.join(STATUS_DIR, `${id}.status`);
    const shell = getDefaultShell();

    const existingPath = process.env.PATH || '';
    const home = process.env.HOME || process.env.USERPROFILE || (process.platform === 'win32' ? 'C:\\' : '/');
    let cwd = options.cwd || home;
    // On macOS, spawning a process whose CWD is inside a TCC-protected
    // directory (~/Downloads, ~/Documents, ~/Desktop) triggers endless
    // permission popups for ad-hoc signed apps.  Fall back to $HOME.
    if (process.platform === 'darwin') {
      const tccDirs = ['Downloads', 'Documents', 'Desktop'].map(d => path.join(home, d));
      if (tccDirs.some(d => cwd === d || cwd.startsWith(d + '/'))) {
        cwd = home;
      }
    }
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([k]) => k !== 'CLAUDECODE')
        ),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        AIRPORT: '1',
        AIRPORT_PID: String(process.pid),
        AIRPORT_SPAWN_DIR: STATUS_DIR,
        AIRPORT_STATUS_FILE: statusFile,
        PATH: `${BIN_DIR}${path.delimiter}${existingPath}`,
      } as Record<string, string>,
    });

    proc.onData((data) => onData(id, data));
    proc.onExit(({ exitCode }) => {
      onExit(id, exitCode);
      this.cleanupSession(id);
    });

    this.sessions.set(id, { process: proc, id, statusFile });

    // On Windows, inject a PowerShell prompt hook that writes CWD to a file
    if (process.platform === 'win32' && (shell === 'pwsh.exe' || shell === 'powershell.exe')) {
      const cwdFile = path.join(STATUS_DIR, `${id}.cwd`);
      const escapedPath = cwdFile.replace(/\\/g, '\\\\');
      const hookCmd = [
        `function prompt { $PWD.Path | Out-File -Encoding utf8 -NoNewline '${escapedPath}'`,
        `; return "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) " }`,
        `; cls`,
      ].join('');
      setTimeout(() => proc.write(hookCmd + '\r'), 500);
    }

    return id;
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.process.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    try {
      this.sessions.get(sessionId)?.process.resize(cols, rows);
    } catch {
      // Ignore resize errors on closed PTY
    }
  }

  close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.kill();
      this.cleanupSession(sessionId);
    }
  }

  getProcessName(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    try {
      const name = session.process.process;
      // On Windows, node-pty returns full exe path — normalize to basename
      return process.platform === 'win32' ? path.basename(name, '.exe') : name;
    } catch {
      return '';
    }
  }

  getPid(sessionId: string): number | undefined {
    return this.sessions.get(sessionId)?.process.pid;
  }

  getStatusFile(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.statusFile;
  }

  getOwnPids(): number[] {
    const pids: number[] = [];
    for (const session of this.sessions.values()) {
      pids.push(session.process.pid);
    }
    return pids;
  }

  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  closeAll(): void {
    for (const [id] of this.sessions) {
      this.close(id);
    }
    // Clean up the status directory
    try { fs.rmSync(STATUS_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try { fs.unlinkSync(session.statusFile); } catch { /* ignore */ }
      this.sessions.delete(sessionId);
    }
  }
}
