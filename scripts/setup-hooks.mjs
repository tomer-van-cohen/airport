#!/usr/bin/env node
/**
 * Installs Airport's Claude Code hooks into ~/.claude/settings.json.
 * Runs automatically via `npm start` (prestart). Idempotent — safe to run
 * repeatedly. Preserves all non-Airport hook entries.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const busyScript = join(projectRoot, 'hooks', 'airport-busy.sh');
const doneScript = join(projectRoot, 'hooks', 'airport-done.sh');

const DESIRED_HOOKS = {
  UserPromptSubmit: busyScript,
  PreToolUse:       busyScript,
  PostToolUse:      doneScript,
  Stop:             doneScript,
  Notification:     doneScript,
};

const isAirportHook = (cmd) =>
  cmd.endsWith('/hooks/airport-busy.sh') || cmd.endsWith('/hooks/airport-done.sh');

const claudeDir = join(homedir(), '.claude');
const settingsPath = join(claudeDir, 'settings.json');

// Read or create settings
let settings;
try {
  settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
} catch {
  mkdirSync(claudeDir, { recursive: true });
  settings = {};
}

if (!settings.hooks) settings.hooks = {};

let installed = 0;
let updated = 0;

for (const [event, scriptPath] of Object.entries(DESIRED_HOOKS)) {
  if (!settings.hooks[event]) settings.hooks[event] = [];

  const entries = settings.hooks[event];
  const newEntry = {
    hooks: [{ type: 'command', command: scriptPath }],
  };

  // Find existing Airport entry for this event
  let found = false;
  for (const entry of entries) {
    const cmds = (entry.hooks || []);
    const airportCmd = cmds.find((h) => h.command && isAirportHook(h.command));
    if (airportCmd) {
      if (airportCmd.command !== scriptPath) {
        airportCmd.command = scriptPath;
        updated++;
      }
      found = true;
      break;
    }
  }

  if (!found) {
    entries.push(newEntry);
    installed++;
  }
}

writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

if (installed > 0) {
  console.log(`✓ Airport hooks installed (${installed} event${installed > 1 ? 's' : ''}) in ${settingsPath}`);
} else if (updated > 0) {
  console.log(`✓ Airport hooks updated (${updated} path${updated > 1 ? 's' : ''}) in ${settingsPath}`);
} else {
  console.log('✓ Airport hooks already up to date');
}
