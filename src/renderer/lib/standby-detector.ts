const SILENCE_THRESHOLD_MS = 3000;

const SHELL_PROMPT_PATTERNS = [
  /\$\s*$/,
  /❯\s*$/,
  />\s*$/,
  /\]\s*$/,
  /%\s*$/,
];

const CLAUDE_WAITING_PATTERNS = [
  />\s*$/,
  /\?\s*$/,
  /waiting for input/i,
  /Press Enter/i,
  /\(y\/n\)/i,
  /\[Y\/n\]/i,
];

const SHELL_PROCESSES = new Set([
  'zsh', 'bash', 'fish', 'sh', 'tcsh', 'csh',
]);

const AI_CLI_PROCESSES = new Set([
  'claude', 'aider', 'cursor',
]);

export interface StandbyState {
  isStandby: boolean;
  reason: string;
}

export function detectStandby(
  lastOutputAt: number,
  processName: string,
  lastLine: string,
  bellReceived: boolean
): StandbyState {
  const silenceDuration = Date.now() - lastOutputAt;
  const isSilent = silenceDuration >= SILENCE_THRESHOLD_MS;

  if (!isSilent && !bellReceived) {
    return { isStandby: false, reason: '' };
  }

  if (bellReceived) {
    return { isStandby: true, reason: 'bell' };
  }

  const baseProcess = processName.split('/').pop() || '';

  if (SHELL_PROCESSES.has(baseProcess)) {
    const isPrompt = SHELL_PROMPT_PATTERNS.some((p) => p.test(lastLine));
    if (isPrompt || isSilent) {
      return { isStandby: true, reason: 'shell-idle' };
    }
  }

  if (AI_CLI_PROCESSES.has(baseProcess)) {
    const isWaiting = CLAUDE_WAITING_PATTERNS.some((p) => p.test(lastLine));
    if (isWaiting) {
      return { isStandby: true, reason: 'ai-waiting' };
    }
  }

  if (isSilent) {
    return { isStandby: true, reason: 'silence' };
  }

  return { isStandby: false, reason: '' };
}
