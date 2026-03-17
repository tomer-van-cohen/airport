interface OnboardingScreenProps {
  onNewSession: () => void;
  onAdoptTerminals: () => void;
}

export function OnboardingScreen({ onNewSession, onAdoptTerminals }: OnboardingScreenProps) {
  const buttonBase: React.CSSProperties = {
    padding: '14px 24px',
    background: '#313244',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'background 0.15s, border-color 0.15s',
    width: '100%',
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const handleHover = (e: React.MouseEvent, hover: boolean) => {
    const el = e.currentTarget as HTMLElement;
    el.style.background = hover ? '#45475a' : '#313244';
    el.style.borderColor = hover ? '#585b70' : '#45475a';
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1e2e',
      }}
    >
      <div style={{ maxWidth: 380, width: '100%', padding: '0 32px' }}>
        <h1
          style={{
            color: '#cdd6f4',
            fontSize: 28,
            fontWeight: 600,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            margin: '0 0 8px 0',
          }}
        >

          Welcome to Airport 🛫
        </h1>
        <p
          style={{
            color: '#6c7086',
            fontSize: 14,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            margin: '0 0 16px 0',
            lineHeight: 1.5,
          }}
        >
          Where AI agents take off.
        </p>
        <p
          style={{
            color: '#7f849c',
            fontSize: 12,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            margin: '0 0 20px 0',
            lineHeight: 1.5,
          }}
        >
          Got a list of tasks? Ask Claude to spawn an agent for each — each will open in its own tab, build a plan, and wait for your instructions.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onNewSession}
            style={buttonBase}
            onMouseEnter={(e) => handleHover(e, true)}
            onMouseLeave={(e) => handleHover(e, false)}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: '#89b4fa22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              +
            </span>
            <div>
              <div style={{ fontWeight: 500 }}>Start a new session</div>
              <div style={{ fontSize: 12, color: '#6c7086', marginTop: 2 }}>
                Open a fresh terminal
              </div>
            </div>
          </button>

          <button
            onClick={onAdoptTerminals}
            style={buttonBase}
            onMouseEnter={(e) => handleHover(e, true)}
            onMouseLeave={(e) => handleHover(e, false)}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: '#a6e3a122',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              ~
            </span>
            <div>
              <div style={{ fontWeight: 500 }}>Bring all terminals home</div>
              <div style={{ fontSize: 12, color: '#6c7086', marginTop: 2 }}>
                Adopt your open terminal sessions
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
