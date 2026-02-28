import { useEffect, useCallback, useState, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { MainTerminal } from './components/MainTerminal';
import { TerminalSquareGrid } from './components/TerminalSquareGrid';
import { SessionControls } from './components/SessionControls';
import { OnboardingScreen } from './components/OnboardingScreen';
import { useTerminalStore } from './store/terminal-store';
import { usePtyBridge } from './hooks/usePtyBridge';

const DEFAULT_SIDEBAR_WIDTH = 384; // 320 * 1.2
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 600;

export function App() {
  const { sessions, activeSessionId, setActiveSession } = useTerminalStore();
  const { createSession, closeSession, setMainDimensions, restoreState, clearTerminal } = usePtyBridge();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const dragging = useRef(false);

  // Restore previous state (no auto-create — show onboarding if empty)
  useEffect(() => {
    restoreState();
  }, []);

  const handleNewSession = useCallback(async () => {
    const id = await createSession();
    useTerminalStore.getState().setActiveSession(id);
  }, [createSession]);

  const handleAdoptTerminals = useCallback(async () => {
    const terminals = await window.airport.discoverTerminals();
    if (terminals.length === 0) return;

    let firstId: string | null = null;
    for (const terminal of terminals) {
      const id = await createSession({
        cwd: terminal.cwd,
        title: terminal.cwd.split('/').pop() || terminal.shell,
      });
      if (!firstId) firstId = id;
    }
    if (firstId) {
      useTerminalStore.getState().setActiveSession(firstId);
    }
  }, [createSession]);

  const handleDimensions = useCallback(
    (cols: number, rows: number) => {
      setMainDimensions(cols, rows);
    },
    [setMainDimensions]
  );

  // Sidebar resize drag
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 't') {
        e.preventDefault();
        handleNewSession();
        return;
      }

      if (e.metaKey && e.key === 'w') {
        e.preventDefault();
        if (activeSessionId) {
          closeSession(activeSessionId);
        }
        return;
      }

      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const visible = sessions.filter((s) => !s.backlog);
        const idx = parseInt(e.key) - 1;
        if (idx < visible.length) {
          setActiveSession(visible[idx].id);
        }
        return;
      }

      if (e.metaKey && e.key === ']') {
        e.preventDefault();
        const visible = sessions.filter((s) => !s.backlog);
        const idx = visible.findIndex((s) => s.id === activeSessionId);
        if (visible.length > 0) {
          setActiveSession(visible[(idx + 1) % visible.length].id);
        }
        return;
      }

      if (e.metaKey && e.key === '[') {
        e.preventDefault();
        const visible = sessions.filter((s) => !s.backlog);
        const idx = visible.findIndex((s) => s.id === activeSessionId);
        if (visible.length > 0) {
          setActiveSession(visible[(idx - 1 + visible.length) % visible.length].id);
        }
        return;
      }

      if (e.metaKey && e.key === 'j') {
        e.preventDefault();
        const visible = sessions.filter((s) => !s.backlog);
        const idx = visible.findIndex((s) => s.id === activeSessionId);
        for (let i = 1; i <= visible.length; i++) {
          const candidate = visible[(idx + i) % visible.length];
          if (candidate.hookDone) {
            setActiveSession(candidate.id);
            break;
          }
        }
        return;
      }

      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        if (activeSessionId) {
          clearTerminal(activeSessionId);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSessionId, sessions, handleNewSession, closeSession, setActiveSession, clearTerminal]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#000000',
      }}
    >
      <TitleBar />

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
          {sessions.length === 0 ? (
            <OnboardingScreen
              onNewSession={handleNewSession}
              onAdoptTerminals={handleAdoptTerminals}
            />
          ) : activeSessionId ? (
            <MainTerminal
              key={activeSessionId}
              sessionId={activeSessionId}
              onDimensions={handleDimensions}
            />
          ) : null}
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onResizeStart}
          style={{
            width: 5,
            cursor: 'col-resize',
            background: 'transparent',
            flexShrink: 0,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 2,
            width: 1,
            background: '#313244',
            transition: 'background 0.15s',
          }} />
        </div>

        <div
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#181825',
            overflow: 'hidden',
          }}
        >
          <TerminalSquareGrid
            onClose={closeSession}
          />
          <SessionControls onNewSession={handleNewSession} onAdoptTerminals={handleAdoptTerminals} />
        </div>
      </div>
    </div>
  );
}
