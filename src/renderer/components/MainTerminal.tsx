import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { SerializeAddon } from '@xterm/addon-serialize';
import { terminalTheme } from '../lib/theme';
import { serializeShadowBuffer } from '../lib/terminal-factory';
import '@xterm/xterm/css/xterm.css';

interface MainTerminalProps {
  sessionId: string;
  onDimensions: (cols: number, rows: number) => void;
}

export function MainTerminal({ sessionId, onDimensions }: MainTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const handleResize = useCallback(() => {
    if (fitRef.current && termRef.current) {
      fitRef.current.fit();
      onDimensions(termRef.current.cols, termRef.current.rows);
    }
  }, [onDimensions]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: terminalTheme,
      allowProposedApi: true,
      scrollback: 5000,
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });

    const fitAddon = new FitAddon();
    const serializeAddon = new SerializeAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(serializeAddon);

    term.open(containerRef.current);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not available, fall back to canvas renderer
    }

    // Let Ctrl+Tab bubble to the window handler
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.key === 'Tab') return false;
      return true;
    });

    fitAddon.fit();
    termRef.current = term;
    fitRef.current = fitAddon;

    // Restore buffer from shadow terminal
    const savedBuffer = serializeShadowBuffer(sessionId);
    if (savedBuffer) {
      term.write(savedBuffer);
    }

    onDimensions(term.cols, term.rows);
    term.focus();

    // Forward input to PTY
    const dataDisposable = term.onData((data) => {
      window.airport.pty.write(sessionId, data);
    });

    // Receive PTY output
    const unsubData = window.airport.pty.onData(({ sessionId: sid, data }) => {
      if (sid === sessionId) {
        term.write(data);
      }
    });

    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      dataDisposable.dispose();
      unsubData();
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '4px',
      }}
    />
  );
}
