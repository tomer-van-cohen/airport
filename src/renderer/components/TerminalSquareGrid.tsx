import { useState, useRef } from 'react';
import { TerminalSquare } from './TerminalSquare';
import { getTabColor } from './RedDotIndicator';
import { useTerminalStore } from '../store/terminal-store';

interface TerminalSquareGridProps {
  onClose: (sessionId: string) => void;
}

export function TerminalSquareGrid({ onClose }: TerminalSquareGridProps) {
  const { sessions, activeSessionId, setActiveSession, reorderSession } = useTerminalStore();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex === null || index === dragIndex) {
      setDropIndex(null);
      return;
    }
    setDropIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      reorderSession(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
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
      {sessions.map((session, index) => (
        <div key={session.id} style={{ position: 'relative' }}>
          {dropIndex === index && dragIndex !== null && dragIndex > index && (
            <div
              style={{
                position: 'absolute',
                top: -5,
                left: 4,
                right: 4,
                height: 2,
                background: '#89b4fa',
                borderRadius: 1,
                zIndex: 10,
              }}
            />
          )}
          <TerminalSquare
            session={session}
            isActive={session.id === activeSessionId}
            tabColor={getTabColor(session.colorIndex)}
            onClick={() => setActiveSession(session.id)}
            onClose={() => onClose(session.id)}
            draggable
            onDragStart={handleDragStart(index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver(index)}
          />
          {dropIndex === index && dragIndex !== null && dragIndex < index && (
            <div
              style={{
                position: 'absolute',
                bottom: -5,
                left: 4,
                right: 4,
                height: 2,
                background: '#89b4fa',
                borderRadius: 1,
                zIndex: 10,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
