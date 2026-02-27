import { Terminal } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';
import { terminalTheme } from './theme';

interface ShadowTerminal {
  terminal: Terminal;
  serializeAddon: SerializeAddon;
  element: HTMLDivElement;
}

const shadowTerminals = new Map<string, ShadowTerminal>();

let shadowContainer: HTMLDivElement | null = null;

function getShadowContainer(): HTMLDivElement {
  if (!shadowContainer) {
    shadowContainer = document.createElement('div');
    shadowContainer.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;';
    document.body.appendChild(shadowContainer);
  }
  return shadowContainer;
}

export function createShadowTerminal(sessionId: string, cols: number, rows: number): ShadowTerminal {
  const existing = shadowTerminals.get(sessionId);
  if (existing) return existing;

  const element = document.createElement('div');
  element.style.cssText = `width:${cols * 8}px;height:${rows * 16}px;`;
  getShadowContainer().appendChild(element);

  const terminal = new Terminal({
    cols,
    rows,
    theme: terminalTheme,
    allowProposedApi: true,
    scrollback: 5000,
  });

  const serializeAddon = new SerializeAddon();
  terminal.loadAddon(serializeAddon);
  terminal.open(element);

  const shadow: ShadowTerminal = { terminal, serializeAddon, element };
  shadowTerminals.set(sessionId, shadow);
  return shadow;
}

export function getShadowTerminal(sessionId: string): ShadowTerminal | undefined {
  return shadowTerminals.get(sessionId);
}

export function writeShadowTerminal(sessionId: string, data: string): void {
  shadowTerminals.get(sessionId)?.terminal.write(data);
}

export function serializeShadowBuffer(sessionId: string): string {
  const shadow = shadowTerminals.get(sessionId);
  if (!shadow) return '';
  return shadow.serializeAddon.serialize();
}

export function resizeAllShadowTerminals(cols: number, rows: number): void {
  for (const [, shadow] of shadowTerminals) {
    shadow.terminal.resize(cols, rows);
    shadow.element.style.width = `${cols * 8}px`;
    shadow.element.style.height = `${rows * 16}px`;
  }
}

// Read the last `count` non-empty *logical* lines from the terminal buffer.
// Soft-wrapped rows (isWrapped) are joined back into a single logical line so that
// a long question like "Do you want to… instead?" reads as one string, not 2-3 fragments.
export function readShadowTerminalLines(sessionId: string, count = 30): string[] {
  const shadow = shadowTerminals.get(sessionId);
  if (!shadow) return [];

  const buf = shadow.terminal.buffer.active;
  const total = buf.length;
  const result: string[] = [];

  for (let y = Math.max(0, total - count); y < total; y++) {
    const line = buf.getLine(y);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && result.length > 0) {
      // Continuation of previous logical line — append
      result[result.length - 1] += text;
    } else if (text.trim()) {
      result.push(text);
    }
  }

  return result;
}

export function disposeShadowTerminal(sessionId: string): void {
  const shadow = shadowTerminals.get(sessionId);
  if (shadow) {
    shadow.terminal.dispose();
    shadow.element.remove();
    shadowTerminals.delete(sessionId);
  }
}
