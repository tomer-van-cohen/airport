import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { PtyCreateOptions, PtyDataEvent, PtyExitEvent, HookStatusEvent, HookPlanEvent, SpawnRequestEvent, AirportApi, SessionInfo, SavedState, ExternalTerminal, PlanFile } from '../shared/types';

const api: AirportApi = {
  pty: {
    create: (options: PtyCreateOptions) =>
      ipcRenderer.invoke(IPC.PTY_CREATE, options),

    write: (sessionId: string, data: string) =>
      ipcRenderer.send(IPC.PTY_WRITE, sessionId, data),

    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send(IPC.PTY_RESIZE, sessionId, cols, rows),

    close: (sessionId: string) =>
      ipcRenderer.send(IPC.PTY_CLOSE, sessionId),

    getProcessName: (sessionId: string) =>
      ipcRenderer.invoke(IPC.PTY_GET_PROCESS_NAME, sessionId),

    onData: (callback: (event: PtyDataEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: PtyDataEvent) => callback(data);
      ipcRenderer.on(IPC.PTY_DATA, handler);
      return () => ipcRenderer.removeListener(IPC.PTY_DATA, handler);
    },

    onExit: (callback: (event: PtyExitEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: PtyExitEvent) => callback(data);
      ipcRenderer.on(IPC.PTY_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC.PTY_EXIT, handler);
    },
  },
  getSessionInfo: (sessionId: string): Promise<SessionInfo> =>
    ipcRenderer.invoke(IPC.GET_SESSION_INFO, sessionId),
  saveState: (state: SavedState): Promise<void> =>
    ipcRenderer.invoke(IPC.STATE_SAVE, state),
  loadState: (): Promise<SavedState | null> =>
    ipcRenderer.invoke(IPC.STATE_LOAD),
  onRequestSave: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.STATE_REQUEST_SAVE, handler);
    return () => ipcRenderer.removeListener(IPC.STATE_REQUEST_SAVE, handler);
  },
  discoverTerminals: (): Promise<ExternalTerminal[]> =>
    ipcRenderer.invoke(IPC.DISCOVER_TERMINALS),
  getPlanFiles: (cwd: string): Promise<PlanFile[]> =>
    ipcRenderer.invoke(IPC.PLAN_GET_FILES, cwd),
  readPlanFile: (path: string): Promise<string> =>
    ipcRenderer.invoke(IPC.PLAN_READ_FILE, path),
  onHookStatus: (callback: (event: HookStatusEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: HookStatusEvent) => callback(data);
    ipcRenderer.on(IPC.HOOK_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC.HOOK_STATUS, handler);
  },
  onHookPlan: (callback: (event: HookPlanEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: HookPlanEvent) => callback(data);
    ipcRenderer.on(IPC.HOOK_PLAN, handler);
    return () => ipcRenderer.removeListener(IPC.HOOK_PLAN, handler);
  },
  onSpawnRequest: (callback: (event: SpawnRequestEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SpawnRequestEvent) => callback(data);
    ipcRenderer.on(IPC.SPAWN_REQUEST, handler);
    return () => ipcRenderer.removeListener(IPC.SPAWN_REQUEST, handler);
  },
  setActiveSession: (sessionId: string) =>
    ipcRenderer.send(IPC.ACTIVE_SESSION_CHANGED, sessionId),
  onNotificationClick: (callback: (sessionId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string) => callback(sessionId);
    ipcRenderer.on(IPC.NOTIFICATION_CLICK, handler);
    return () => ipcRenderer.removeListener(IPC.NOTIFICATION_CLICK, handler);
  },
};

contextBridge.exposeInMainWorld('airport', api);
