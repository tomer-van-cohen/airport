export interface ParsedStatus {
  label: string;
  isWaiting: boolean;
  isBusy: boolean;
}

const BUSY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /Thinking|thinking/,         label: 'Thinking...' },
  { pattern: /Reading|reading/,           label: 'Reading...' },
  { pattern: /Writing|writing/,           label: 'Writing...' },
  { pattern: /Editing|editing/,           label: 'Editing...' },
  { pattern: /Running|running/,           label: 'Running...' },
  { pattern: /Searching|searching/,       label: 'Searching...' },
  { pattern: /Installing|installing/,     label: 'Installing...' },
  { pattern: /Compiling|compiling/,       label: 'Compiling...' },
  { pattern: /Analyzing|analyzing/,       label: 'Analyzing...' },
  { pattern: /Updating|updating/,         label: 'Updating...' },
];

const WAITING_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\?\s*$/,                    label: 'Waiting for input' },
  { pattern: />\s*$/,                     label: 'Ready' },
];

const AI_CLI_PROCESSES = new Set(['claude', 'aider', 'cursor']);

export function parseStatus(processName: string, lastLine: string, lastChunk: string = ''): ParsedStatus {
  const base = processName.split('/').pop() || '';

  if (!AI_CLI_PROCESSES.has(base)) {
    if (base) return { label: base, isWaiting: false, isBusy: false };
    return { label: 'Terminal', isWaiting: false, isBusy: false };
  }

  // Check both the last \n-terminated line AND the latest raw chunk.
  // Claude Code writes status updates via \r without \n, so the chunk
  // is the only way to see "Thinking...", "Reading file.ts", etc.
  const sources = [lastChunk, lastLine];

  for (const text of sources) {
    for (const { pattern, label } of BUSY_PATTERNS) {
      if (pattern.test(text)) {
        return { label, isWaiting: false, isBusy: true };
      }
    }
  }

  for (const text of sources) {
    for (const { pattern, label } of WAITING_PATTERNS) {
      if (pattern.test(text)) {
        return { label, isWaiting: true, isBusy: false };
      }
    }
  }

  // AI CLI is the foreground process but no recognized pattern.
  // Default to not-busy/not-waiting — let the normal idle/active
  // logic based on lastOutputAt decide.
  return { label: base, isWaiting: false, isBusy: false };
}
