import type { Terminal, IDisposable } from '@xterm/xterm';
import { analyzeLine, type CellStyle } from './bidi-renderer';
import { terminalTheme } from './theme';

// Standard 256-color palette (indices 0-15 from theme, 16-255 computed)
const palette256 = buildPalette256();

function buildPalette256(): string[] {
  const p: string[] = [];
  // 0-7: standard colors from theme
  const themeColors = [
    terminalTheme.black, terminalTheme.red, terminalTheme.green, terminalTheme.yellow,
    terminalTheme.blue, terminalTheme.magenta, terminalTheme.cyan, terminalTheme.white,
  ];
  // 8-15: bright colors
  const brightColors = [
    terminalTheme.brightBlack, terminalTheme.brightRed, terminalTheme.brightGreen, terminalTheme.brightYellow,
    terminalTheme.brightBlue, terminalTheme.brightMagenta, terminalTheme.brightCyan, terminalTheme.brightWhite,
  ];
  for (const c of themeColors) p.push(c as string);
  for (const c of brightColors) p.push(c as string);

  // 16-231: 6x6x6 color cube
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        const rv = r ? r * 40 + 55 : 0;
        const gv = g ? g * 40 + 55 : 0;
        const bv = b ? b * 40 + 55 : 0;
        p.push(`rgb(${rv},${gv},${bv})`);
      }
    }
  }
  // 232-255: grayscale
  for (let i = 0; i < 24; i++) {
    const v = i * 10 + 8;
    p.push(`rgb(${v},${v},${v})`);
  }
  return p;
}

// Color mode constants from xterm.js (IBufferCell.getFgColorMode/getBgColorMode)
const COLOR_MODE_DEFAULT = 0;
const COLOR_MODE_PALETTE = 1;
const COLOR_MODE_RGB = 2;

function colorToCSS(colorMode: number, color: number, isDefault: boolean, isFg: boolean): string {
  if (isDefault) {
    return (isFg ? terminalTheme.foreground : terminalTheme.background) as string;
  }
  switch (colorMode) {
    case COLOR_MODE_DEFAULT:
      return (isFg ? terminalTheme.foreground : terminalTheme.background) as string;
    case COLOR_MODE_PALETTE:
      return palette256[color] || (isFg ? terminalTheme.foreground : terminalTheme.background) as string;
    case COLOR_MODE_RGB:
      return `rgb(${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff})`;
    default:
      return (isFg ? terminalTheme.foreground : terminalTheme.background) as string;
  }
}

interface CellDimensions {
  width: number;
  height: number;
}

function getCellDimensions(term: Terminal, container: HTMLElement): CellDimensions {
  // Try to get dimensions from the xterm screen element
  const screen = container.querySelector('.xterm-screen') as HTMLElement | null;
  if (screen) {
    const w = screen.clientWidth / term.cols;
    const h = screen.clientHeight / term.rows;
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  // Fallback: estimate from font size
  return { width: term.options.fontSize! * 0.6, height: term.options.fontSize! * 1.2 };
}

export class BidiOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private disposables: IDisposable[] = [];
  private term: Terminal;
  private container: HTMLElement;
  private dirty = false;
  private rafId = 0;
  private cellDims: CellDimensions = { width: 0, height: 0 };

  constructor(term: Terminal, container: HTMLElement) {
    this.term = term;
    this.container = container;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:100;';
    // Insert overlay inside the xterm screen element so it aligns with the terminal content
    const screen = container.querySelector('.xterm-screen');
    if (screen) {
      (screen as HTMLElement).style.position = 'relative';
      screen.appendChild(this.canvas);
    } else {
      container.style.position = 'relative';
      container.appendChild(this.canvas);
    }

    this.ctx = this.canvas.getContext('2d')!;

    // Listen for terminal events that require redraw
    this.disposables.push(term.onWriteParsed(() => this.markDirty()));
    this.disposables.push(term.onScroll(() => this.markDirty()));
    this.disposables.push(term.onRender(() => this.markDirty()));

    this.markDirty();
  }

  private markDirty(): void {
    if (!this.dirty) {
      this.dirty = true;
      this.rafId = requestAnimationFrame(() => this.render());
    }
  }

  private render(): void {
    this.dirty = false;
    this.rafId = 0;

    const term = this.term;
    const buffer = term.buffer.active;
    const cols = term.cols;
    const rows = term.rows;

    this.cellDims = getCellDimensions(term, this.container);
    const { width: cellW, height: cellH } = this.cellDims;
    if (cellW === 0 || cellH === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasW = Math.ceil(cellW * cols);
    const canvasH = Math.ceil(cellH * rows);

    if (this.canvas.width !== Math.ceil(canvasW * dpr) || this.canvas.height !== Math.ceil(canvasH * dpr)) {
      this.canvas.width = Math.ceil(canvasW * dpr);
      this.canvas.height = Math.ceil(canvasH * dpr);
      this.canvas.style.width = `${canvasW}px`;
      this.canvas.style.height = `${canvasH}px`;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);

    const fontSize = term.options.fontSize || 14;
    const fontFamily = term.options.fontFamily || 'monospace';

    // Check each visible row for RTL content
    for (let row = 0; row < rows; row++) {
      const bufferRow = buffer.baseY + row;
      const info = analyzeLine(buffer, bufferRow, cols);
      if (!info.hasRtl) continue;

      // This row has RTL content — draw it on the overlay
      const y = row * cellH;

      // First: paint opaque background to hide xterm's wrong-order rendering
      ctx.fillStyle = terminalTheme.background as string;
      ctx.fillRect(0, y, canvasW, cellH);

      // Draw each character in visual order
      let x = 0;
      for (let vi = 0; vi < info.visualChars.length; vi++) {
        const ch = info.visualChars[vi];
        const style = info.visualStyles[vi];
        const w = info.visualWidths[vi];
        const charW = cellW * w;

        // Background
        const bgColor = this.resolveBg(style);
        if (bgColor !== terminalTheme.background) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, y, charW, cellH);
        }

        // Text
        if (ch !== ' ') {
          const fgColor = this.resolveFg(style);
          ctx.fillStyle = fgColor;

          let fontStr = '';
          if (style.bold && style.italic) fontStr = `bold italic ${fontSize}px ${fontFamily}`;
          else if (style.bold) fontStr = `bold ${fontSize}px ${fontFamily}`;
          else if (style.italic) fontStr = `italic ${fontSize}px ${fontFamily}`;
          else fontStr = `${fontSize}px ${fontFamily}`;
          ctx.font = fontStr;

          if (style.dim) ctx.globalAlpha = 0.5;
          ctx.textBaseline = 'middle';
          ctx.fillText(ch, x, y + cellH / 2);
          if (style.dim) ctx.globalAlpha = 1.0;

          // Underline
          if (style.underline) {
            ctx.strokeStyle = fgColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + cellH - 1);
            ctx.lineTo(x + charW, y + cellH - 1);
            ctx.stroke();
          }

          // Strikethrough
          if (style.strikethrough) {
            ctx.strokeStyle = fgColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + cellH / 2);
            ctx.lineTo(x + charW, y + cellH / 2);
            ctx.stroke();
          }
        }

        x += charW;
      }

      // Draw cursor on this RTL line if cursor is here
      if (buffer.cursorY === row) {
        const logicalCursorX = buffer.cursorX;
        // Find cursor in visual order
        const vi = info.logicalToVisual[logicalCursorX];
        if (vi !== undefined && vi >= 0) {
          let cursorX = 0;
          for (let i = 0; i < vi; i++) {
            cursorX += cellW * info.visualWidths[i];
          }
          // Draw cursor bar
          ctx.fillStyle = terminalTheme.cursor as string;
          ctx.fillRect(cursorX, y, 2, cellH);
        }
      }
    }
  }

  private resolveFg(style: CellStyle): string {
    if (style.inverse) {
      return colorToCSS(style.bgColorMode, style.bgColor, style.isBgDefault, false);
    }
    return colorToCSS(style.fgColorMode, style.fgColor, style.isFgDefault, true);
  }

  private resolveBg(style: CellStyle): string {
    if (style.inverse) {
      return colorToCSS(style.fgColorMode, style.fgColor, style.isFgDefault, true);
    }
    return colorToCSS(style.bgColorMode, style.bgColor, style.isBgDefault, false);
  }

  dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    for (const d of this.disposables) d.dispose();
    this.canvas.remove();
  }
}
