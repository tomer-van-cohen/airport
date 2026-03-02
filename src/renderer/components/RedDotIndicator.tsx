import { useState } from 'react';
import type { SessionStatus } from '../../shared/types';

const SPINNER_ID = 'airport-spinner';

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById(SPINNER_ID)) {
  const style = document.createElement('style');
  style.id = SPINNER_ID;
  style.textContent = `@keyframes airport-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

// Catppuccin Mocha palette — one color per tab
export const TAB_COLORS = [
  '#89b4fa', // blue
  '#a6e3a1', // green
  '#f9e2af', // yellow
  '#cba6f7', // mauve
  '#f38ba8', // red
  '#fab387', // peach
  '#94e2d5', // teal
  '#f5c2e7', // pink
  '#74c7ec', // sapphire
  '#eba0ac', // maroon
];

export function getTabColor(index: number): string {
  const i = Number.isFinite(index) ? index : 0;
  return TAB_COLORS[i % TAB_COLORS.length];
}

// Convert hex to rgba for the spinner ring background
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function StatusDot({ status, color = '#89b4fa', onClose }: { status: SessionStatus; color?: string; onClose?: () => void }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose?.();
  };

  if (hovered && onClose) {
    return (
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          top: 3,
          right: 3,
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#f38ba8',
          zIndex: 2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          fontWeight: 700,
          lineHeight: 1,
          color: '#000',
        }}
      >
        ×
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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
            border: `2px solid ${hexToRgba(color, 0.25)}`,
            borderTopColor: color,
            animation: 'airport-spin 0.8s linear infinite',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        position: 'absolute',
        top: 5,
        right: 5,
        zIndex: 2,
      }}
    />
  );
}
