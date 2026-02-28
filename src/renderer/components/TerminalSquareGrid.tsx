import { useState } from 'react';
import { TerminalSquare } from './TerminalSquare';
import { getTabColor } from './RedDotIndicator';
import { useTerminalStore } from '../store/terminal-store';

interface TerminalSquareGridProps {
  onClose: (sessionId: string) => void;
}

type DragSource = { sessionId: string; zone: 'normal' | 'backlog'; globalIndex: number };

export function TerminalSquareGrid({ onClose }: TerminalSquareGridProps) {
  const { sessions, activeSessionId, setActiveSession, reorderSession, moveToBacklog, restoreFromBacklog } = useTerminalStore();

  const normalSessions = sessions.filter((s) => !s.backlog);
  const backlogSessions = sessions.filter((s) => s.backlog);

  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{ zone: 'normal' | 'backlog' | 'backlog-header'; index: number } | null>(null);
  const [backlogExpanded, setBacklogExpanded] = useState(false);

  const globalIndex = (zone: 'normal' | 'backlog', localIndex: number) => {
    if (zone === 'normal') return sessions.indexOf(normalSessions[localIndex]);
    return sessions.indexOf(backlogSessions[localIndex]);
  };

  const handleDragStart = (zone: 'normal' | 'backlog', localIndex: number, sessionId: string) => (e: React.DragEvent) => {
    const gi = globalIndex(zone, localIndex);
    setDragSource({ sessionId, zone, globalIndex: gi });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (zone: 'normal' | 'backlog' | 'backlog-header', localIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragSource) { setDropTarget(null); return; }
    if (zone === dragSource.zone && localIndex === (zone === 'normal' ? normalSessions.findIndex((s) => s.id === dragSource.sessionId) : backlogSessions.findIndex((s) => s.id === dragSource.sessionId))) {
      setDropTarget(null);
      return;
    }
    setDropTarget({ zone, index: localIndex });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragSource || !dropTarget) { clearDrag(); return; }

    const { zone: fromZone, sessionId, globalIndex: fromGlobal } = dragSource;
    const { zone: toZone, index: toLocal } = dropTarget;

    if (toZone === 'backlog-header') {
      // Drop on backlog header → move to backlog
      if (fromZone === 'normal') {
        moveToBacklog(sessionId);
      }
    } else if (fromZone === toZone) {
      // Same zone reorder
      const toGlobal = globalIndex(toZone, toLocal);
      if (fromGlobal !== toGlobal) {
        reorderSession(fromGlobal, toGlobal);
      }
    } else if (fromZone === 'backlog' && toZone === 'normal') {
      // Backlog → normal: restore and insert at position
      const insertGlobal = globalIndex('normal', toLocal);
      restoreFromBacklog(sessionId, insertGlobal);
    } else if (fromZone === 'normal' && toZone === 'backlog') {
      // Normal → backlog: move to backlog
      moveToBacklog(sessionId);
      setBacklogExpanded(true);
    }

    clearDrag();
  };

  const clearDrag = () => {
    setDragSource(null);
    setDropTarget(null);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const renderSessionItem = (
    zone: 'normal' | 'backlog',
    list: typeof sessions,
    session: typeof sessions[0],
    localIndex: number,
  ) => {
    const dragLocalIndex = dragSource?.zone === zone
      ? list.findIndex((s) => s.id === dragSource.sessionId)
      : null;
    const isDropTarget = dropTarget?.zone === zone && dropTarget.index === localIndex;
    const showAbove = isDropTarget && dragLocalIndex !== null && dragLocalIndex > localIndex;
    const showBelow = isDropTarget && dragLocalIndex !== null && dragLocalIndex < localIndex;
    // Cross-zone drop: show above indicator
    const showCrossZone = isDropTarget && dragSource?.zone !== zone;

    return (
      <div key={session.id} style={{ position: 'relative' }}>
        {(showAbove || showCrossZone) && (
          <div style={{ position: 'absolute', top: -5, left: 4, right: 4, height: 2, background: '#89b4fa', borderRadius: 1, zIndex: 10 }} />
        )}
        <TerminalSquare
          session={session}
          isActive={session.id === activeSessionId}
          tabColor={getTabColor(session.colorIndex)}
          onClick={() => setActiveSession(session.id)}
          onClose={() => onClose(session.id)}
          draggable
          onDragStart={handleDragStart(zone, localIndex, session.id)}
          onDragEnd={clearDrag}
          onDragOver={handleDragOver(zone, localIndex)}
        />
        {showBelow && (
          <div style={{ position: 'absolute', bottom: -5, left: 4, right: 4, height: 2, background: '#89b4fa', borderRadius: 1, zIndex: 10 }} />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 8px 0',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: 1,
      }}
      onDragOver={handleContainerDragOver}
      onDrop={handleDrop}
    >
      {/* Normal sessions */}
      {normalSessions.map((session, index) =>
        renderSessionItem('normal', normalSessions, session, index)
      )}

      {/* Backlog section */}
      {(sessions.length > 0) && (
        <div style={{ marginTop: normalSessions.length > 0 ? 4 : 0 }}>
          {/* Backlog header / drop target */}
          <div
            onClick={() => backlogSessions.length > 0 && setBacklogExpanded(!backlogExpanded)}
            onDragOver={handleDragOver('backlog-header', 0)}
            onDragEnter={(e) => {
              e.preventDefault();
              if (dragSource?.zone === 'normal') {
                setDropTarget({ zone: 'backlog-header', index: 0 });
              }
            }}
            onDragLeave={() => {
              if (dropTarget?.zone === 'backlog-header') setDropTarget(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 4px',
              cursor: backlogSessions.length > 0 ? 'pointer' : 'default',
              borderRadius: 4,
              transition: 'background 0.15s',
              background: dropTarget?.zone === 'backlog-header' ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
              border: dropTarget?.zone === 'backlog-header' ? '1px dashed #89b4fa' : '1px dashed transparent',
            }}
          >
            {/* Chevron */}
            <svg
              width={10}
              height={10}
              viewBox="0 0 10 10"
              fill="#585b70"
              style={{
                transform: backlogExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
                flexShrink: 0,
              }}
            >
              <path d="M3 1.5L7 5L3 8.5" stroke="#585b70" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#585b70',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Backlog
            </span>
            {backlogSessions.length > 0 && (
              <span style={{
                fontSize: 9,
                color: '#6c7086',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: 500,
                background: '#313244',
                borderRadius: 8,
                padding: '1px 5px',
                minWidth: 16,
                textAlign: 'center',
              }}>
                {backlogSessions.length}
              </span>
            )}
          </div>

          {/* Backlog items */}
          {backlogExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {backlogSessions.map((session, index) =>
                renderSessionItem('backlog', backlogSessions, session, index)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
