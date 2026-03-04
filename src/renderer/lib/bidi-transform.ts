import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

// Matches Hebrew, Arabic, Syriac, Arabic Supplement / Presentation Forms
const RTL_CHAR_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Matches all common ANSI escape sequences (CSI, OSC, character set designators)
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[()][012AB])/g;

/**
 * Apply Unicode BiDi visual reordering to terminal output.
 *
 * xterm.js renders all characters left-to-right. This function reorders RTL
 * characters (Hebrew, Arabic, etc.) into visual order so they display correctly.
 *
 * Fast-path: returns data unchanged if no RTL characters are detected.
 */
export function processBidi(data: string): string {
  if (!RTL_CHAR_REGEX.test(data)) {
    return data;
  }

  const lines = data.split('\n');
  for (let i = 0; i < lines.length; i++) {
    lines[i] = processLine(lines[i]);
  }
  return lines.join('\n');
}

function processLine(line: string): string {
  // Quick check: no RTL chars in this line, skip
  if (!RTL_CHAR_REGEX.test(line)) return line;

  // 1. Strip ANSI escape sequences, record their positions (by plain-text char index)
  const ansiAtSlot = new Map<number, string>();
  let plainText = '';
  let lastIndex = 0;

  ANSI_REGEX.lastIndex = 0;
  let match;
  while ((match = ANSI_REGEX.exec(line)) !== null) {
    plainText += line.substring(lastIndex, match.index);
    const slot = plainText.length;
    ansiAtSlot.set(slot, (ansiAtSlot.get(slot) || '') + match[0]);
    lastIndex = match.index + match[0].length;
  }
  plainText += line.substring(lastIndex);

  if (plainText.length === 0) return line;
  if (!RTL_CHAR_REGEX.test(plainText)) return line;

  // 2. Run BiDi algorithm on the plain text
  const embeddingLevels = bidi.getEmbeddingLevels(plainText, 'ltr');
  const reorderedIndices = bidi.getReorderedIndices(plainText, embeddingLevels);

  // 3. Build visual-order plain text (with bracket mirroring for RTL chars)
  let reorderedChars = '';
  for (let i = 0; i < reorderedIndices.length; i++) {
    const origIndex = reorderedIndices[i];
    if (embeddingLevels.levels[origIndex] & 1) {
      // RTL character — apply mirroring (e.g. '(' ↔ ')')
      reorderedChars += bidi.getMirroredCharacter(plainText[origIndex]) || plainText[origIndex];
    } else {
      reorderedChars += plainText[origIndex];
    }
  }

  // 4. Re-insert ANSI escape codes at their original slot positions
  if (ansiAtSlot.size === 0) return reorderedChars;

  let result = '';
  for (let i = 0; i <= reorderedChars.length; i++) {
    const ansi = ansiAtSlot.get(i);
    if (ansi) result += ansi;
    if (i < reorderedChars.length) result += reorderedChars[i];
  }

  return result;
}
