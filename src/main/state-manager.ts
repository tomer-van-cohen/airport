import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { SavedState } from '../shared/types';

const STATE_FILE = path.join(app.getPath('userData'), 'session-state.json');

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
