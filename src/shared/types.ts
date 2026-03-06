export interface PlanFile {
  name: string;
  path: string;
  modifiedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
}

export interface TerminalSession {
  id: string;
  title: string;
  customTitle: boolean;
  status: SessionStatus;
  processName: string;
  isStandby: boolean;
  lastOutputAt: number;
  hookMessage: string;
  hookDone: boolean;
  waitingQuestion: string;
  gitRepo: string;
  gitBranch: string;
  colorIndex: number;
  backlog: boolean;
  cwd: string;
  planFiles: PlanFile[];
  workspaceId: string;
}

export type SessionStatus =
  | 'active'
  | 'idle'
  | 'standby'
  | 'waiting-for-input';

export interface PtyCreateOptions {
  cols: number;
  rows: number;
  cwd?: string;
}

export interface PtyDataEvent {
  sessionId: string;
  data: string;
}

export interface PtyExitEvent {
  sessionId: string;
  exitCode: number;
}

export interface PtyProcessInfo {
  sessionId: string;
  processName: string;
}

export interface SessionInfo {
  cwd: string;
  gitRepo: string;
  gitBranch: string;
}

export interface SavedSession {
  title: string;
  customTitle: boolean;
  cwd: string;
  buffer: string;
  colorIndex: number;
  backlog?: boolean;
  workspaceId?: string;
}

export interface SavedState {
  sessions: SavedSession[];
  activeIndex: number;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}

export interface HookStatusEvent {
  sessionId: string;
  state: 'busy' | 'done';
  message: string;
}

export interface HookPlanEvent {
  sessionId: string;
  planPath: string;
}

export interface SpawnRequestEvent {
  title?: string;
  cwd?: string;
  command?: string;
}

export interface ExternalTerminal {
  pid: number;
  tty: string;
  shell: string;
  cwd: string;
}

export interface AirportApi {
  pty: {
    create: (options: PtyCreateOptions) => Promise<string>;
    write: (sessionId: string, data: string) => void;
    resize: (sessionId: string, cols: number, rows: number) => void;
    close: (sessionId: string) => void;
    getProcessName: (sessionId: string) => Promise<string>;
    onData: (callback: (event: PtyDataEvent) => void) => () => void;
    onExit: (callback: (event: PtyExitEvent) => void) => () => void;
  };
  getSessionInfo: (sessionId: string) => Promise<SessionInfo>;
  saveState: (state: SavedState) => Promise<void>;
  loadState: () => Promise<SavedState | null>;
  onRequestSave: (callback: () => void) => () => void;
  onHookStatus: (callback: (event: HookStatusEvent) => void) => () => void;
  onHookPlan: (callback: (event: HookPlanEvent) => void) => () => void;
  onSpawnRequest: (callback: (event: SpawnRequestEvent) => void) => () => void;
  discoverTerminals: () => Promise<ExternalTerminal[]>;
  getPlanFiles: (cwd: string) => Promise<PlanFile[]>;
  readPlanFile: (path: string) => Promise<string>;
  setActiveSession: (sessionId: string) => void;
  onNotificationClick: (callback: (sessionId: string) => void) => () => void;
}

declare global {
  interface Window {
    airport: AirportApi;
  }
}
