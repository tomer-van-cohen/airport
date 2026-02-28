import { useState, useRef, useEffect } from 'react';
import { StatusDot } from './RedDotIndicator';
import { useTerminalStore } from '../store/terminal-store';
import type { TerminalSession } from '../../shared/types';

interface TerminalSquareProps {
  session: TerminalSession;
  isActive: boolean;
  tabColor: string;
  onClick: () => void;
  onClose: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

export function TerminalSquare({ session, isActive, tabColor, onClick, onClose, draggable, onDragStart, onDragEnd, onDragOver }: TerminalSquareProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const [titleHovered, setTitleHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const setSessionTitle = useTerminalStore((s) => s.setSessionTitle);
  const folderName = !session.gitRepo && session.cwd ? session.cwd.split('/').filter(Boolean).pop() || '' : '';

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitTitle = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      setSessionTitle(session.id, trimmed, true);
    } else {
      setDraft(session.title);
    }
    setEditing(false);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(session.title);
    setEditing(true);
  };

  return (
    <div
      onClick={onClick}
      draggable={draggable && !editing}
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart?.(e);
      }}
      onDragEnd={(e) => {
        setIsDragging(false);
        onDragEnd?.(e);
      }}
      onDragOver={onDragOver}
      style={{
        position: 'relative',
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        border: isActive ? `2px solid ${tabColor}` : '2px solid #313244',
        background: '#11111b',
        transition: 'border-color 0.15s ease, opacity 0.15s ease',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <StatusDot status={session.status} color={tabColor} onClose={onClose} />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: 'absolute',
          top: 3,
          left: 4,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#45475a',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 7,
          color: '#cdd6f4',
          zIndex: 3,
          padding: 0,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.background = '#f38ba8';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.opacity = '0';
          (e.target as HTMLElement).style.background = '#45475a';
        }}
      >
        ×
      </button>

      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 14,
        }}
        onMouseEnter={() => setTitleHovered(true)}
        onMouseLeave={() => setTitleHovered(false)}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') { setDraft(session.title); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#cdd6f4',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              background: '#313244',
              border: '1px solid #585b70',
              borderRadius: 3,
              outline: 'none',
              padding: '0 3px',
              marginLeft: 12,
              flex: 1,
              minWidth: 0,
            }}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            paddingRight: 14,
            overflow: 'hidden',
            flex: 1,
            minWidth: 0,
          }}>
            {!session.customTitle && session.gitRepo && session.gitBranch ? (
              <div
                onDoubleClick={startEditing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  overflow: 'hidden',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <svg width={9} height={9} viewBox="0 0 16 16" fill="#585b70" style={{ flexShrink: 0 }}>
                  <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
                </svg>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#cdd6f4',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {session.gitRepo}
                </span>
                <svg width={9} height={9} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: 4 }}>
                  <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6a2.5 2.5 0 01-2.5 2.5H7.5v2.878a2.251 2.251 0 11-1.5 0V4.622a2.251 2.251 0 111.5 0V6h2.5a1 1 0 001-1v-.628A2.251 2.251 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM4.25 2.5a.75.75 0 100 1.5.75.75 0 000-1.5z" fill="#585b70"/>
                </svg>
                <span style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: '#89b4fa',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {session.gitBranch}
                </span>
              </div>
            ) : (
              <span
                onDoubleClick={startEditing}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#cdd6f4',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {session.title}
                {folderName && (
                  <span style={{ fontWeight: 400, color: '#6c7086' }}> ({folderName})</span>
                )}
              </span>
            )}
            {titleHovered && (
              <button
                onClick={startEditing}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 3px',
                  fontSize: 10,
                  color: '#6c7086',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#cdd6f4'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#6c7086'; }}
              >
                ✎
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 10,
        lineHeight: '14px',
        color: '#a6adc8',
        background: '#181825',
        borderRadius: 3,
        padding: '4px 6px',
        minHeight: 50,
      }}>
        {!session.hookDone && session.hookMessage ? (
          // Busy: activity message from hook
          <div style={{
            color: '#89b4fa',
            fontStyle: 'italic',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {session.hookMessage}
          </div>
        ) : session.hookDone && session.waitingQuestion ? (
          // Done with a question — waiting for user's response
          <div>
            <div style={{ color: '#f9e2af', fontStyle: 'italic', marginBottom: 2 }}>
              Waiting for your response:
            </div>
            <div style={{
              color: '#cdd6f4',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {session.waitingQuestion}
            </div>
          </div>
        ) : session.hookDone ? (
          // Done, no question — persistent completion message
          <div style={{ color: '#a6e3a1', fontStyle: 'italic' }}>
            Waiting for your next instructions.
          </div>
        ) : (
          <span style={{ color: '#585b70' }}>...</span>
        )}
      </div>
    </div>
  );
}
