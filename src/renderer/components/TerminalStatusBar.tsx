import { parseStatus } from '../lib/status-parser';

interface TerminalStatusBarProps {
  processName: string;
  lastLine: string;
}

export function TerminalStatusBar({ processName, lastLine }: TerminalStatusBarProps) {
  const { label } = parseStatus(processName, lastLine);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 22,
        background: 'rgba(17, 17, 27, 0.85)',
        color: '#a6adc8',
        fontSize: 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        padding: '3px 8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        zIndex: 1,
      }}
    >
      {label}
    </div>
  );
}
