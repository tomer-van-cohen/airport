import { useState, useRef, useEffect } from 'react';

interface SessionControlsProps {
  onNewSession: () => void;
  onAdoptTerminals: () => void;
}

export function SessionControls({ onNewSession, onAdoptTerminals }: SessionControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const buttonBase: React.CSSProperties = {
    padding: '8px 12px',
    background: '#313244',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    transition: 'background 0.15s',
  };

  const handleHover = (e: React.MouseEvent, hover: boolean) => {
    (e.currentTarget as HTMLElement).style.background = hover ? '#45475a' : '#313244';
  };

  return (
    <div style={{ padding: '8px', position: 'relative' }} ref={menuRef}>
      <div style={{ display: 'flex', gap: 0 }}>
        <button
          onClick={onNewSession}
          style={{
            ...buttonBase,
            flex: 1,
            borderRadius: '6px 0 0 6px',
            borderRight: 'none',
          }}
          onMouseEnter={(e) => handleHover(e, true)}
          onMouseLeave={(e) => handleHover(e, false)}
        >
          + New Session
        </button>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            ...buttonBase,
            width: 36,
            borderRadius: '0 6px 6px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
            fontSize: 16,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => handleHover(e, true)}
          onMouseLeave={(e) => handleHover(e, false)}
        >
          ⋮
        </button>
      </div>

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 8,
            right: 8,
            marginBottom: 4,
            background: '#313244',
            border: '1px solid #45475a',
            borderRadius: 6,
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <button
            onClick={() => {
              setMenuOpen(false);
              onAdoptTerminals();
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              color: '#cdd6f4',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#45475a';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            Bring All Terminals Home
          </button>
        </div>
      )}
    </div>
  );
}
