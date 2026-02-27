import type { SessionStatus } from '../../shared/types';

const SPINNER_ID = 'airport-spinner';

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById(SPINNER_ID)) {
  const style = document.createElement('style');
  style.id = SPINNER_ID;
  style.textContent = `@keyframes airport-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

export function StatusDot({ status }: { status: SessionStatus }) {
  if (status === 'active') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 10,
          height: 10,
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '2px solid rgba(137, 180, 250, 0.25)',
            borderTopColor: '#89b4fa',
            animation: 'airport-spin 0.8s linear infinite',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: '#89b4fa',
        position: 'absolute',
        top: 5,
        right: 5,
        zIndex: 2,
      }}
    />
  );
}
