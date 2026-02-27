interface SessionControlsProps {
  onNewSession: () => void;
}

export function SessionControls({ onNewSession }: SessionControlsProps) {
  return (
    <div style={{ padding: '8px' }}>
      <button
        onClick={onNewSession}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: '#313244',
          color: '#cdd6f4',
          border: '1px solid #45475a',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = '#45475a';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = '#313244';
        }}
      >
        + New Session
      </button>
    </div>
  );
}
