import bidiFactory from 'bidi-js';
import type { IBuffer, IBufferCell } from '@xterm/xterm';

const bidi = bidiFactory();

// Matches Hebrew, Arabic, Syriac, Arabic Supplement / Presentation Forms
const RTL_CHAR_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\uFB50-\uFDFF\uFE70-\uFEFF]/;

export interface CellStyle {
  fgColor: number;
  bgColor: number;
  fgColorMode: number;
  bgColorMode: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  dim: boolean;
  strikethrough: boolean;
  inverse: boolean;
  isFgDefault: boolean;
  isBgDefault: boolean;
}

export interface BidiLineInfo {
  hasRtl: boolean;
  /** Maps visual column → logical column */
  visualToLogical: number[];
  /** Maps logical column → visual column */
  logicalToVisual: number[];
  /** The visually reordered characters */
  visualChars: string[];
  /** Cell styles in visual order */
  visualStyles: CellStyle[];
  /** Character widths in visual order */
  visualWidths: number[];
}

const NO_RTL: BidiLineInfo = {
  hasRtl: false,
  visualToLogical: [],
  logicalToVisual: [],
  visualChars: [],
  visualStyles: [],
  visualWidths: [],
};

function extractCellStyle(cell: IBufferCell): CellStyle {
  return {
    fgColor: cell.getFgColor(),
    bgColor: cell.getBgColor(),
    fgColorMode: cell.getFgColorMode(),
    bgColorMode: cell.getBgColorMode(),
    bold: !!cell.isBold(),
    italic: !!cell.isItalic(),
    underline: !!cell.isUnderline(),
    dim: !!cell.isDim(),
    strikethrough: !!cell.isStrikethrough(),
    inverse: !!cell.isInverse(),
    isFgDefault: cell.isFgDefault(),
    isBgDefault: cell.isBgDefault(),
  };
}

/**
 * Analyze a single terminal buffer line for BiDi reordering.
 * Returns reordering info if the line contains RTL characters, or a fast-path NO_RTL result.
 */
export function analyzeLine(buffer: IBuffer, row: number, cols: number): BidiLineInfo {
  const line = buffer.getLine(row);
  if (!line) return NO_RTL;

  // First pass: extract characters and check for RTL
  const chars: string[] = [];
  const styles: CellStyle[] = [];
  const widths: number[] = [];
  // Track which logical indices are "real" (not trailing part of wide char)
  const realIndices: number[] = [];

  const nullCell = buffer.getNullCell();
  let hasRtl = false;

  for (let col = 0; col < cols; col++) {
    const cell = line.getCell(col, nullCell);
    if (!cell) {
      chars.push(' ');
      styles.push(extractCellStyle(nullCell));
      widths.push(1);
      realIndices.push(col);
      continue;
    }

    const w = cell.getWidth();
    if (w === 0) {
      // Trailing cell of a wide character — skip in reordering
      continue;
    }

    const ch = cell.getChars() || ' ';
    if (!hasRtl && RTL_CHAR_REGEX.test(ch)) {
      hasRtl = true;
    }

    chars.push(ch);
    styles.push(extractCellStyle(cell));
    widths.push(w);
    realIndices.push(col);
  }

  if (!hasRtl) return NO_RTL;

  // Run BiDi algorithm
  const plainText = chars.join('');
  const embeddingLevels = bidi.getEmbeddingLevels(plainText, 'ltr');
  const reorderedIndices = bidi.getReorderedIndices(plainText, embeddingLevels);

  const visualChars: string[] = [];
  const visualStyles: CellStyle[] = [];
  const visualWidths: number[] = [];
  const visualToLogical: number[] = [];
  const logicalToVisual: number[] = new Array(chars.length).fill(-1);

  for (let vi = 0; vi < reorderedIndices.length; vi++) {
    const li = reorderedIndices[vi];
    const isRtl = embeddingLevels.levels[li] & 1;
    const ch = isRtl
      ? (bidi.getMirroredCharacter(chars[li]) || chars[li])
      : chars[li];

    visualChars.push(ch);
    visualStyles.push(styles[li]);
    visualWidths.push(widths[li]);
    visualToLogical.push(realIndices[li]);
    logicalToVisual[li] = vi;
  }

  return {
    hasRtl: true,
    visualToLogical,
    logicalToVisual,
    visualChars,
    visualStyles,
    visualWidths,
  };
}

/**
 * Simple BiDi reorder for a plain string (used by snapshot renderer).
 */
export function reorderString(text: string): string {
  if (!RTL_CHAR_REGEX.test(text)) return text;
  return bidi.getReorderedString(text, bidi.getEmbeddingLevels(text, 'ltr'));
}
