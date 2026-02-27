import { getShadowTerminal } from './terminal-factory';
import { terminalTheme } from './theme';

const CHAR_WIDTH = 7;
const CHAR_HEIGHT = 14;
const FONT = '12px monospace';

export function renderSnapshot(
  sessionId: string,
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  const shadow = getShadowTerminal(sessionId);
  if (!shadow) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = terminalTheme.background as string;
  ctx.fillRect(0, 0, width, height);

  ctx.font = FONT;
  ctx.textBaseline = 'top';

  const buffer = shadow.terminal.buffer.active;
  const cols = shadow.terminal.cols;
  const visibleRows = Math.min(Math.floor(height / CHAR_HEIGHT), shadow.terminal.rows);

  const scaleX = width / (cols * CHAR_WIDTH);
  const scaleY = height / (visibleRows * CHAR_HEIGHT);
  const scale = Math.min(scaleX, scaleY, 1);

  ctx.save();
  ctx.scale(scale, scale);

  for (let row = 0; row < visibleRows; row++) {
    const line = buffer.getLine(row + buffer.baseY);
    if (!line) continue;

    let text = '';
    for (let col = 0; col < cols; col++) {
      const cell = line.getCell(col);
      if (!cell) {
        text += ' ';
        continue;
      }
      text += cell.getChars() || ' ';
    }

    ctx.fillStyle = terminalTheme.foreground as string;
    ctx.fillText(text.trimEnd(), 2, row * CHAR_HEIGHT + 1);
  }

  ctx.restore();
}
