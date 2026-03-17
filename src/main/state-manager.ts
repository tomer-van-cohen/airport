import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { SavedState } from '../shared/types';

function getDefaultDataDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Airport');
  }
  return path.join(os.homedir(), 'Library', 'Application Support', 'Airport');
}
const DATA_DIR = process.env.AIRPORT_DATA_DIR || getDefaultDataDir();
fs.mkdirSync(DATA_DIR, { recursive: true });
const STATE_FILE = path.join(DATA_DIR, 'session-state.json');

export function saveState(state: SavedState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch {
    // ignore write errors
  }
}

export function loadState(): SavedState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const state = JSON.parse(raw) as SavedState;
    if (state.sessions && Array.isArray(state.sessions)) {
      return state;
    }
    return null;
  } catch {
    return null;
  }
}
