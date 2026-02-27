import { useEffect, useRef } from 'react';
import { useTerminalStore } from '../store/terminal-store';
import {
  createShadowTerminal,
  writeShadowTerminal,
  disposeShadowTerminal,
  resizeAllShadowTerminals,
  serializeShadowBuffer,
  readShadowTerminalLines,
} from '../lib/terminal-factory';
import { detectStandby } from '../lib/standby-detector';
import { parseStatus } from '../lib/status-parser';
import type { SavedSession } from '../../shared/types';

const lastLines = new Map<string, string[]>();
const lastChunks = new Map<string, string>();
const bellFlags = new Map<string, boolean>();
const cachedCwds = new Map<string, string>();

// Hook-reported status from Claude Code via file-based IPC.
// This is the authoritative signal — when present it overrides heuristics.
interface HookState {
  state: 'busy' | 'done';
  message: string;
}
const hookStates = new Map<string, HookState>();

function stripAnsi(s: string): string {
  return s.replace(/\x1b[\[\]()][?!>]?[0-9;]*[a-zA-Z~]/g, '').replace(/\x1b[=>]/g, '').replace(/\r/g, '').trim();
}

// Read the rendered terminal buffer to extract the question header Claude asked.
// Scans backward past bullet-point options to find the introducing line (ends with '?' or ':').
// Returns "question\n→ default", just "question", or ''.
function extractQuestion(sessionId: string, hookMsg: string): string {
  const termLines = readShadowTerminalLines(sessionId, 30);
  const hookQ = hookMsg.trim();

  // 1. hookMsg is already concise — use it if it looks like a question
  if (hookQ.endsWith('?') || hookQ.endsWith(':')) {
    const defaultAnswer = findDefault(termLines);
    if (defaultAnswer) return `${hookQ}\n→ ${defaultAnswer}`;
    return hookQ;
  }

  // 2. Scan backward for the question header: the nearest non-bullet line ending with '?' or ':'
  //    Skip bullets, prompts (❯), and any other intermediate lines.
  let question = '';
  let questionIdx = -1;

  for (let i = termLines.length - 1; i >= 0; i--) {
    const t = termLines[i].trim();
    if (t.startsWith('-') || t.startsWith('*')) continue;
    if (t.endsWith('?') || t.endsWith(':')) {
      question = t;
      questionIdx = i;
      break;
    }
  }

  if (!question) return '';

  const afterQ = questionIdx >= 0 ? termLines.slice(questionIdx + 1) : termLines;
  const defaultAnswer = findDefault(afterQ);
  if (defaultAnswer) return `${question}\n→ ${defaultAnswer}`;
  return question;
}

function findDefault(lines: string[]): string {
  for (const line of lines) {
    if (line.includes('❯')) {
      const match = line.match(/❯\s+(?:\d+\.\s+)?(.+)/);
      if (match) return match[1].trim();
    }
  }
  return '';
}

export function usePtyBridge() {
  const { addSession, removeSession, updateLastOutput, setSessionStandby, setSessionProcessName, setSessionStatus, setSessionTitle, setSessionGitInfo, setHookMessage, setHookDone, setWaitingQuestion } =
    useTerminalStore();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const mainDimsRef = useRef({ cols: 80, rows: 24 });

  useEffect(() => {
    const unsubData = window.airport.pty.onData(({ sessionId, data }) => {
      writeShadowTerminal(sessionId, data);
      updateLastOutput(sessionId);

      // Last chunk for parseStatus / detectStandby heuristics
      const cleaned = stripAnsi(data);
      if (cleaned.length > 0) {
        lastChunks.set(sessionId, cleaned);
      }

      // Track last 20 complete lines (lines followed by \n), ignoring typing echoes
      // 20 is enough to keep the question line even when Claude renders a multi-line menu after it
      if (data.includes('\n')) {
        const parts = data.split('\n');
        const complete = parts.slice(0, -1)
          .map((l) => stripAnsi(l))
          .filter((l) => l.length > 0 && !/^\[[\?!][0-9;]*[a-zA-Z]$/.test(l));
        if (complete.length > 0) {
          const prev = lastLines.get(sessionId) || [];
          const combined = [...prev, ...complete].slice(-20);
          lastLines.set(sessionId, combined);
        }
      }

      if (data.includes('\x07')) {
        bellFlags.set(sessionId, true);
      }
    });

    // Listen for hook status updates from main process (file-based IPC)
    const unsubHook = window.airport.onHookStatus(({ sessionId, state, message }) => {
      hookStates.set(sessionId, { state, message });
      if (state === 'busy') {
        setHookMessage(sessionId, message);
        setHookDone(sessionId, false);
        setWaitingQuestion(sessionId, '');
        setSessionStandby(sessionId, false);
        setSessionStatus(sessionId, 'active');
      } else {
        // done — always write hookMessage (even empty) so stale busy text is cleared
        setHookMessage(sessionId, message);
        setHookDone(sessionId, true);
        setSessionStandby(sessionId, true);
        setSessionStatus(sessionId, 'waiting-for-input');
        // Defer question extraction slightly so the last terminal chunk has time to arrive
        setTimeout(() => {
          const question = extractQuestion(sessionId, message);
          setWaitingQuestion(sessionId, question);
        }, 100);
      }
    });

    const unsubExit = window.airport.pty.onExit(({ sessionId }) => {
      disposeShadowTerminal(sessionId);
      removeSession(sessionId);
      lastLines.delete(sessionId);
      lastChunks.delete(sessionId);
      bellFlags.delete(sessionId);
      cachedCwds.delete(sessionId);
      hookStates.delete(sessionId);
    });

    // Polling: standby detection + git title updates
    pollIntervalRef.current = setInterval(async () => {
      const sessions = useTerminalStore.getState().sessions;
      for (const session of sessions) {
        const processName = await window.airport.pty.getProcessName(session.id);
        setSessionProcessName(session.id, processName);

        const hook = hookStates.get(session.id);
        const lines = lastLines.get(session.id) || [];
        const lastLine = lines[lines.length - 1] || '';
        const lastChunk = lastChunks.get(session.id) || '';
        const bell = bellFlags.get(session.id) || false;

        // Hook status is authoritative when present
        if (hook) {
          if (hook.state === 'busy') {
            setSessionStandby(session.id, false);
            setSessionStatus(session.id, 'active');
          } else {
            // done — waiting for user input
            setSessionStandby(session.id, true);
            setSessionStatus(session.id, 'waiting-for-input');
          }
        } else {
          // Fallback: heuristic-based detection for non-hooked CLIs
          const status = parseStatus(processName, lastLine, lastChunk);
          const { isStandby } = detectStandby(session.lastOutputAt, processName, lastLine, bell);

          if (status.isBusy) {
            setSessionStandby(session.id, false);
            setSessionStatus(session.id, 'active');
          } else if (isStandby || status.isWaiting) {
            setSessionStandby(session.id, true);
            setSessionStatus(session.id, 'waiting-for-input');
          } else {
            setSessionStandby(session.id, false);
            setSessionStatus(session.id, 'idle');
          }
        }

        try {
          const info = await window.airport.getSessionInfo(session.id);
          if (info.cwd) cachedCwds.set(session.id, info.cwd);
          if (!session.customTitle && info.gitRepo && info.gitBranch) {
            const gitTitle = `${info.gitRepo}/${info.gitBranch}`;
            if (session.title !== gitTitle) {
              setSessionTitle(session.id, gitTitle);
            }
            if (session.gitRepo !== info.gitRepo || session.gitBranch !== info.gitBranch) {
              setSessionGitInfo(session.id, info.gitRepo, info.gitBranch);
            }
          } else if (session.gitRepo || session.gitBranch) {
            setSessionGitInfo(session.id, '', '');
          }
        } catch { /* ignore */ }

        bellFlags.set(session.id, false);
      }
    }, 1000);

    // Save state when main process requests it (before quit)
    const unsubSaveRequest = window.airport.onRequestSave(() => {
      saveAllSessions();
    });

    return () => {
      unsubData();
      unsubHook();
      unsubExit();
      unsubSaveRequest();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const createSession = async (options?: { cwd?: string; title?: string; customTitle?: boolean; buffer?: string }) => {
    const { cols, rows } = mainDimsRef.current;
    const sessionId = await window.airport.pty.create({ cols, rows, cwd: options?.cwd });
    createShadowTerminal(sessionId, cols, rows);

    // If restoring a buffer, write it to the shadow terminal
    if (options?.buffer) {
      writeShadowTerminal(sessionId, options.buffer);
    }

    addSession({
      id: sessionId,
      title: options?.title || `Terminal ${useTerminalStore.getState().sessions.length + 1}`,
      customTitle: options?.customTitle || false,
      status: 'active',
      processName: '',
      isStandby: false,
      lastOutputAt: Date.now(),
      hookMessage: '',
      hookDone: false,
      waitingQuestion: '',
      gitRepo: '',
      gitBranch: '',
    });
    return sessionId;
  };

  const closeSession = (sessionId: string) => {
    window.airport.pty.close(sessionId);
    disposeShadowTerminal(sessionId);
    removeSession(sessionId);
    lastLines.delete(sessionId);
    lastChunks.delete(sessionId);
    bellFlags.delete(sessionId);
    cachedCwds.delete(sessionId);
    hookStates.delete(sessionId);
  };

  const setMainDimensions = (cols: number, rows: number) => {
    mainDimsRef.current = { cols, rows };
    resizeAllShadowTerminals(cols, rows);
    const sessions = useTerminalStore.getState().sessions;
    for (const s of sessions) {
      window.airport.pty.resize(s.id, cols, rows);
    }
  };

  const getHookMessage = (sessionId: string) => hookStates.get(sessionId)?.message || '';

  const saveAllSessions = () => {
    const { sessions, activeSessionId } = useTerminalStore.getState();
    const saved: SavedSession[] = sessions.map((session) => ({
      title: session.title,
      customTitle: session.customTitle,
      cwd: cachedCwds.get(session.id) || '',
      buffer: serializeShadowBuffer(session.id),
    }));

    const activeIndex = sessions.findIndex((s) => s.id === activeSessionId);
    window.airport.saveState({ sessions: saved, activeIndex: Math.max(activeIndex, 0) });
  };

  const restoreState = async (): Promise<boolean> => {
    const state = await window.airport.loadState();
    if (!state || state.sessions.length === 0) return false;

    const newIds: string[] = [];
    for (const saved of state.sessions) {
      const id = await createSession({
        cwd: saved.cwd || undefined,
        title: saved.title,
        customTitle: saved.customTitle,
        buffer: saved.buffer,
      });
      newIds.push(id);
    }

    // Set the previously active session
    if (state.activeIndex >= 0 && state.activeIndex < newIds.length) {
      useTerminalStore.getState().setActiveSession(newIds[state.activeIndex]);
    }

    return true;
  };

  const clearTerminal = (sessionId: string) => {
    window.airport.pty.write(sessionId, '\x0c');
  };

  return { createSession, closeSession, setMainDimensions, getHookMessage, restoreState, saveAllSessions, clearTerminal };
}
