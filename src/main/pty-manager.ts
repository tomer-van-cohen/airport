import * as pty from 'node-pty';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PtyCreateOptions } from '../shared/types';

interface PtySession {
  process: pty.IPty;
  id: string;
  statusFile: string;
}

const STATUS_DIR = path.join(os.tmpdir(), `airport-${process.pid}`);

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
    const shell = process.env.SHELL || '/bin/zsh';

    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd || process.env.HOME || '/',
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([k]) => k !== 'CLAUDECODE')
        ),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        AIRPORT: '1',
        AIRPORT_STATUS_FILE: statusFile,
      } as Record<string, string>,
    });

    proc.onData((data) => onData(id, data));
    proc.onExit(({ exitCode }) => {
      onExit(id, exitCode);
      this.cleanupSession(id);
    });

    this.sessions.set(id, { process: proc, id, statusFile });
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
      return session.process.process;
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
