import { useState, useEffect, useRef, useMemo } from 'react';
import { useTerminalStore } from '../store/terminal-store';
import { getTabColor } from './RedDotIndicator';

interface QuickSwitcherProps {
  onClose: () => void;
}

export function QuickSwitcher({ onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { sessions, activeSessionId, activeWorkspaceId, workspaces, setActiveSession, setActiveWorkspace } = useTerminalStore();

  const workspaceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ws of workspaces) map.set(ws.id, ws.name);
    return map;
  }, [workspaces]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    let results = sessions.filter((s) => {
      if (words.length === 0) return true;
      const text = [
        s.title,
        s.gitRepo,
        s.gitBranch,
        s.cwd,
        s.hookMessage,
        workspaceMap.get(s.workspaceId) || '',
      ].join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    });

    // Sort: current workspace first, then by lastOutputAt desc
    results.sort((a, b) => {
      const aInWs = a.workspaceId === activeWorkspaceId ? 0 : 1;
      const bInWs = b.workspaceId === activeWorkspaceId ? 0 : 1;
      if (aInWs !== bInWs) return aInWs - bInWs;
      return b.lastOutputAt - a.lastOutputAt;
    });

    return results;
  }, [sessions, query, activeWorkspaceId, workspaceMap]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const selectSession = (session: typeof sessions[0]) => {
    // Switch workspace if needed
    if (session.workspaceId !== activeWorkspaceId) {
      setActiveWorkspace(session.workspaceId);
    }
    // Small delay to let workspace switch settle, then set active session
    setTimeout(() => {
      setActiveSession(session.id);
    }, 10);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) selectSession(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const statusIndicator = (status: string) => {
    if (status === 'active') return { color: '#89b4fa', label: 'busy' };
    if (status === 'waiting-for-input') return { color: '#f9e2af', label: 'waiting' };
    if (status === 'idle') return { color: '#6c7086', label: 'idle' };
    return { color: '#585b70', label: status };
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: 500,
          maxHeight: '60vh',
          background: '#1e1e2e',
          borderRadius: 12,
          border: '1px solid #313244',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          alignSelf: 'flex-start',
        }}
      >
        {/* Search input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #313244' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#cdd6f4',
              fontSize: 15,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              padding: 0,
            }}
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {filtered.length === 0 && (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: '#585b70',
              fontSize: 13,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            }}>
              No matching sessions
            </div>
          )}
          {filtered.map((session, index) => {
            const isSelected = index === selectedIndex;
            const si = statusIndicator(session.status);
            const wsName = workspaceMap.get(session.workspaceId) || '';
            const isCurrentWs = session.workspaceId === activeWorkspaceId;
            const isActiveSession = session.id === activeSessionId;

            return (
              <div
                key={session.id}
                onClick={() => selectSession(session)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  background: isSelected ? '#313244' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {/* Color dot */}
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getTabColor(session.colorIndex),
                  flexShrink: 0,
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#cdd6f4',
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {session.title}
                    </span>
                    {isActiveSession && (
                      <span style={{ fontSize: 10, color: '#585b70', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>current</span>
                    )}
                  </div>
                  {(session.gitRepo || !isCurrentWs) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a6adc8', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                      {session.gitRepo && session.gitBranch && (
                        <span>{session.gitRepo}/{session.gitBranch}</span>
                      )}
                      {!isCurrentWs && wsName && (
                        <span style={{ color: '#585b70' }}>{wsName}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Status */}
                <span style={{
                  fontSize: 10,
                  color: si.color,
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {si.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
