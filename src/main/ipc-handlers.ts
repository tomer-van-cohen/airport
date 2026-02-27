import { ipcMain, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { PtyManager } from './pty-manager';
import { IPC } from '../shared/ipc-channels';
import { PtyCreateOptions, SessionInfo, SavedState } from '../shared/types';
import { saveState, loadState } from './state-manager';

const execFileAsync = promisify(execFile);

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

    let cwd = '';
    try {
      // macOS: get cwd of the foreground process in the PTY
      const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
      const match = stdout.match(/\nn(.*)/);
      if (match) cwd = match[1];
    } catch { /* ignore */ }

    if (!cwd) return { cwd: '', gitRepo: '', gitBranch: '' };

    let gitRepo = '';
    let gitBranch = '';
    try {
      const { stdout: topLevel } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd });
      gitRepo = path.basename(topLevel.trim());
      const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
      gitBranch = branch.trim();
    } catch { /* not a git repo */ }

    return { cwd, gitRepo, gitBranch };
  });

  ipcMain.handle(IPC.STATE_SAVE, (_event, state: SavedState) => {
    saveState(state);
  });

  ipcMain.handle(IPC.STATE_LOAD, () => {
    return loadState();
  });
}
