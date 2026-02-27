import { TerminalSquare } from './TerminalSquare';
import { useTerminalStore } from '../store/terminal-store';

interface TerminalSquareGridProps {
  onClose: (sessionId: string) => void;
}

export function TerminalSquareGrid({ onClose }: TerminalSquareGridProps) {
  const { sessions, activeSessionId, setActiveSession } = useTerminalStore();

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
    >
      {sessions.map((session) => (
        <TerminalSquare
          key={session.id}
          session={session}
          isActive={session.id === activeSessionId}
          onClick={() => setActiveSession(session.id)}
          onClose={() => onClose(session.id)}
        />
      ))}
    </div>
  );
}
