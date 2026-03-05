import { create } from 'zustand';
import type { TerminalSession, SessionStatus, PlanFile, Workspace } from '../../shared/types';

const DEFAULT_WORKSPACE_ID = 'default';
const DEFAULT_WORKSPACE: Workspace = { id: DEFAULT_WORKSPACE_ID, name: 'Default' };

interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  previousSessionId: string | null;
  nextColorIndex: number;
  planViewSessionId: string | null;
  planViewPath: string | null;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  workspaceActiveSessionIds: Record<string, string>;

  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<TerminalSession>) => void;
  setSessionStatus: (id: string, status: SessionStatus) => void;
  setSessionStandby: (id: string, isStandby: boolean) => void;
  setSessionProcessName: (id: string, processName: string) => void;
  setSessionTitle: (id: string, title: string, custom?: boolean) => void;
  setSessionGitInfo: (id: string, gitRepo: string, gitBranch: string) => void;
  setSessionCwd: (id: string, cwd: string) => void;
  setHookMessage: (id: string, hookMessage: string) => void;
  setHookDone: (id: string, hookDone: boolean) => void;
  setWaitingQuestion: (id: string, waitingQuestion: string) => void;
  updateLastOutput: (id: string) => void;
  reorderSession: (fromIndex: number, toIndex: number) => void;
  moveToBacklog: (id: string) => void;
  restoreFromBacklog: (id: string, insertIndex?: number) => void;
  setPlanFiles: (id: string, planFiles: PlanFile[]) => void;
  viewPlan: (sessionId: string, path: string) => void;
  closePlanView: () => void;
  addWorkspace: (name?: string) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  setActiveWorkspace: (id: string) => void;
  moveSessionToWorkspace: (sessionId: string, workspaceId: string) => void;
  setWorkspaces: (workspaces: Workspace[], activeId: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,
  previousSessionId: null,
  nextColorIndex: 0,
  planViewSessionId: null,
  planViewPath: null,
  workspaces: [DEFAULT_WORKSPACE],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  workspaceActiveSessionIds: {},

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, {
        ...session,
        backlog: session.backlog ?? false,
        colorIndex: session.colorIndex ?? state.nextColorIndex,
        workspaceId: session.workspaceId || state.activeWorkspaceId,
      }],
      activeSessionId: state.activeSessionId ?? session.id,
      nextColorIndex: Math.max(state.nextColorIndex, (session.colorIndex ?? state.nextColorIndex) + 1),
    })),

  removeSession: (id) =>
    set((state) => {
      const removed = state.sessions.find((s) => s.id === id);
      const sessions = state.sessions.filter((s) => s.id !== id);
      let activeSessionId = state.activeSessionId;
      if (activeSessionId === id) {
        // Pick replacement from same workspace first
        const workspaceId = removed?.workspaceId || state.activeWorkspaceId;
        const sameWorkspace = sessions.filter((s) => s.workspaceId === workspaceId && !s.backlog);
        activeSessionId = sameWorkspace.length > 0
          ? sameWorkspace[sameWorkspace.length - 1].id
          : sessions.length > 0 ? sessions[sessions.length - 1].id : null;
      }
      const clearPlan = state.planViewSessionId === id;
      return {
        sessions,
        activeSessionId,
        ...(clearPlan ? { planViewSessionId: null, planViewPath: null } : {}),
      };
    }),

  setActiveSession: (id) => set((state) => {
    const session = state.sessions.find((s) => s.id === id);
    const workspaceActiveSessionIds = { ...state.workspaceActiveSessionIds };
    if (session) {
      workspaceActiveSessionIds[session.workspaceId] = id;
    }
    return {
      activeSessionId: id,
      previousSessionId: state.activeSessionId !== id ? state.activeSessionId : state.previousSessionId,
      planViewSessionId: null,
      planViewPath: null,
      workspaceActiveSessionIds,
    };
  }),

  updateSession: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  setSessionStatus: (id, status) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    })),

  setSessionStandby: (id, isStandby) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, isStandby } : s
      ),
    })),

  setSessionProcessName: (id, processName) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, processName } : s
      ),
    })),

  setSessionTitle: (id, title, custom = false) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title, customTitle: custom ? true : s.customTitle } : s
      ),
    })),

  setSessionGitInfo: (id, gitRepo, gitBranch) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, gitRepo, gitBranch } : s
      ),
    })),

  setSessionCwd: (id, cwd) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, cwd } : s
      ),
    })),

  setHookMessage: (id, hookMessage) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, hookMessage } : s
      ),
    })),

  setHookDone: (id, hookDone) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, hookDone } : s
      ),
    })),

  setWaitingQuestion: (id, waitingQuestion) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, waitingQuestion } : s
      ),
    })),

  updateLastOutput: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, lastOutputAt: Date.now() } : s
      ),
    })),

  reorderSession: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.sessions.length ||
        toIndex >= state.sessions.length
      ) {
        return state;
      }
      const sessions = [...state.sessions];
      const [moved] = sessions.splice(fromIndex, 1);
      sessions.splice(toIndex, 0, moved);
      return { sessions };
    }),

  moveToBacklog: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, backlog: true } : s
      ),
    })),

  restoreFromBacklog: (id, insertIndex) =>
    set((state) => {
      const sessions = [...state.sessions];
      const idx = sessions.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const [moved] = sessions.splice(idx, 1);
      moved.backlog = false;
      if (insertIndex !== undefined && insertIndex >= 0) {
        sessions.splice(insertIndex, 0, moved);
      } else {
        // Insert at end of normal sessions (before first backlog session)
        const firstBacklogIdx = sessions.findIndex((s) => s.backlog);
        sessions.splice(firstBacklogIdx === -1 ? sessions.length : firstBacklogIdx, 0, moved);
      }
      return { sessions };
    }),

  setPlanFiles: (id, planFiles) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, planFiles } : s
      ),
    })),

  viewPlan: (sessionId, path) =>
    set(() => ({
      planViewSessionId: sessionId,
      planViewPath: path,
    })),

  closePlanView: () =>
    set(() => ({
      planViewSessionId: null,
      planViewPath: null,
    })),

  addWorkspace: (name) =>
    set((state) => {
      const id = crypto.randomUUID();
      const ws: Workspace = { id, name: name || `Workspace ${state.workspaces.length + 1}` };
      return {
        workspaces: [...state.workspaces, ws],
        activeWorkspaceId: id,
      };
    }),

  removeWorkspace: (id) =>
    set((state) => {
      if (state.workspaces.length <= 1) return state;
      const idx = state.workspaces.findIndex((w) => w.id === id);
      if (idx === -1) return state;
      const remaining = state.workspaces.filter((w) => w.id !== id);
      // Move orphaned sessions to adjacent workspace
      const targetId = remaining[Math.min(idx, remaining.length - 1)].id;
      const sessions = state.sessions.map((s) =>
        s.workspaceId === id ? { ...s, workspaceId: targetId } : s
      );
      const activeWorkspaceId = state.activeWorkspaceId === id ? targetId : state.activeWorkspaceId;
      // Restore last active session in new workspace
      const lastActive = state.workspaceActiveSessionIds[activeWorkspaceId];
      const wsSessionExists = sessions.some((s) => s.id === lastActive && s.workspaceId === activeWorkspaceId);
      const activeSessionId = wsSessionExists ? lastActive : state.activeSessionId;
      return { workspaces: remaining, sessions, activeWorkspaceId, activeSessionId };
    }),

  renameWorkspace: (id, name) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, name } : w
      ),
    })),

  setActiveWorkspace: (id) =>
    set((state) => {
      if (state.activeWorkspaceId === id) return state;
      // Save current session for current workspace
      const workspaceActiveSessionIds = { ...state.workspaceActiveSessionIds };
      if (state.activeSessionId) {
        workspaceActiveSessionIds[state.activeWorkspaceId] = state.activeSessionId;
      }
      // Restore last active session in target workspace
      const lastActive = workspaceActiveSessionIds[id];
      const wsSessions = state.sessions.filter((s) => s.workspaceId === id && !s.backlog);
      let activeSessionId: string | null = null;
      if (lastActive && wsSessions.some((s) => s.id === lastActive)) {
        activeSessionId = lastActive;
      } else if (wsSessions.length > 0) {
        activeSessionId = wsSessions[wsSessions.length - 1].id;
      }
      return {
        activeWorkspaceId: id,
        activeSessionId,
        workspaceActiveSessionIds,
        planViewSessionId: null,
        planViewPath: null,
      };
    }),

  moveSessionToWorkspace: (sessionId, workspaceId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, workspaceId } : s
      ),
    })),

  setWorkspaces: (workspaces, activeId) =>
    set(() => ({
      workspaces: workspaces.length > 0 ? workspaces : [DEFAULT_WORKSPACE],
      activeWorkspaceId: activeId || DEFAULT_WORKSPACE_ID,
    })),
}));
