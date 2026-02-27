import { create } from 'zustand';
import type { TerminalSession, SessionStatus } from '../../shared/types';

interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;

  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<TerminalSession>) => void;
  setSessionStatus: (id: string, status: SessionStatus) => void;
  setSessionStandby: (id: string, isStandby: boolean) => void;
  setSessionProcessName: (id: string, processName: string) => void;
  setSessionTitle: (id: string, title: string, custom?: boolean) => void;
  setSessionGitInfo: (id: string, gitRepo: string, gitBranch: string) => void;
  setHookMessage: (id: string, hookMessage: string) => void;
  setHookDone: (id: string, hookDone: boolean) => void;
  setWaitingQuestion: (id: string, waitingQuestion: string) => void;
  updateLastOutput: (id: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId ?? session.id,
    })),

  removeSession: (id) =>
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      let activeSessionId = state.activeSessionId;
      if (activeSessionId === id) {
        activeSessionId = sessions.length > 0 ? sessions[sessions.length - 1].id : null;
      }
      return { sessions, activeSessionId };
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

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
}));
