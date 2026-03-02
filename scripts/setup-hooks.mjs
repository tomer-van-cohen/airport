#!/usr/bin/env node
/**
 * Installs Airport's Claude Code hooks into ~/.claude/settings.json.
 * Runs automatically via `npm start` (prestart). Idempotent — safe to run
 * repeatedly. Preserves all non-Airport hook entries.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync, lstatSync } from 'fs';
import { execSync } from 'child_process';
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
  PostToolUse:      busyScript,
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

// --- Global CLAUDE.md: teach Claude about airport-spawn ---
const claudeMdPath = join(claudeDir, 'CLAUDE.md');
const SPAWN_START = '<!-- airport-spawn -->';
const SPAWN_END = '<!-- /airport-spawn -->';
const SPAWN_BLOCK = `${SPAWN_START}
## Airport Agent Spawning

**IMPORTANT: This section ONLY applies when the \`AIRPORT\` environment variable is set (i.e., you are running inside Airport terminal multiplexer). If \`$AIRPORT\` is not set, ignore this section entirely.**

You can spawn parallel agent sessions — each in its own Airport tab with its own git worktree. **Only do this when the user explicitly asks to spawn agents or work in parallel** (e.g., "spawn agents for these tasks", "do these in parallel", "run these as separate agents"). Never spawn agents on your own initiative — if the user gives you multiple tasks without asking for parallel execution, do them sequentially in the current session.

To spawn an agent:

\`\`\`bash
git worktree add .claude/worktrees/<branch-name> -b <branch-name>
airport-spawn \\
  --cwd "$(pwd)/.claude/worktrees/<branch-name>" \\
  --command "claude --dangerously-skip-permissions '<task prompt>. Create a plan first and wait for my approval before implementing.'"
\`\`\`

Do not pass --title — the tab will automatically show the git repo and branch name from the worktree.
Pass the full prompt as an argument to claude (not -p) so it starts an interactive session with the task.
${SPAWN_END}`;

let claudeMd = '';
try { claudeMd = readFileSync(claudeMdPath, 'utf-8'); } catch { /* doesn't exist yet */ }

const startIdx = claudeMd.indexOf(SPAWN_START);
const endIdx = claudeMd.indexOf(SPAWN_END);

if (startIdx === -1) {
  // Append block (with a leading newline if file has existing content)
  const separator = claudeMd.length > 0 && !claudeMd.endsWith('\n') ? '\n\n' : claudeMd.length > 0 ? '\n' : '';
  writeFileSync(claudeMdPath, claudeMd + separator + SPAWN_BLOCK + '\n');
  console.log(`✓ Airport agent-spawn instructions added to ${claudeMdPath}`);
} else if (endIdx !== -1) {
  // Replace between markers
  const before = claudeMd.slice(0, startIdx);
  const after = claudeMd.slice(endIdx + SPAWN_END.length);
  const updated = before + SPAWN_BLOCK + after;
  if (updated !== claudeMd) {
    writeFileSync(claudeMdPath, updated);
    console.log(`✓ Airport agent-spawn instructions updated in ${claudeMdPath}`);
  } else {
    console.log('✓ Airport agent-spawn instructions already up to date');
  }
} else {
  // Start marker exists but no end marker (corrupted) — replace from start to EOF
  const before = claudeMd.slice(0, startIdx);
  writeFileSync(claudeMdPath, before + SPAWN_BLOCK + '\n');
  console.log(`✓ Airport agent-spawn instructions repaired in ${claudeMdPath}`);
}

// --- Worktree support: symlink node_modules from main repo ---
const localNM = join(projectRoot, 'node_modules');
try {
  const stat = lstatSync(localNM);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    // node_modules already exists (real dir or symlink) — nothing to do
  }
} catch {
  // node_modules doesn't exist — check if we're in a worktree
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', { cwd: projectRoot, encoding: 'utf-8' }).trim();
    const toplevel = execSync('git rev-parse --show-toplevel', { cwd: projectRoot, encoding: 'utf-8' }).trim();
    const mainRepo = resolve(commonDir, '..');
    if (mainRepo !== toplevel) {
      // We're in a worktree — symlink node_modules from the main repo
      const mainNM = join(mainRepo, 'node_modules');
      if (existsSync(mainNM)) {
        symlinkSync(mainNM, localNM);
        console.log(`✓ Symlinked node_modules from ${mainRepo}`);
      }
    }
  } catch {
    // Not a git repo or git not available — skip
  }
}

// --- Dev mode: ensure source has dev/prod instance separation ---
// Older branches may lack the app.setPath('userData', ...) fix needed for
// dev and prod Airport to run side-by-side. Patch the source before Vite
// compiles it so every branch works with `npm start`.
const mainEntry = join(projectRoot, 'src', 'main', 'index.ts');
try {
  let src = readFileSync(mainEntry, 'utf-8');
  if (!src.includes("app.setPath('userData'")) {
    // Inject the dev-mode userData separation after app.setName (or after the squirrel-startup guard)
    const DEV_BLOCK = [
      `const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;`,
      `app.setName(isDev ? 'Airport Dev' : 'Airport');`,
      `if (isDev) {`,
      `  app.setPath('userData', path.join(app.getPath('appData'), 'Airport Dev'));`,
      `}`,
    ].join('\n');

    // Replace existing app.setName line(s), or inject after squirrel guard
    if (src.includes('app.setName(')) {
      // Remove all existing setName variants and replace with full block
      src = src.replace(/^.*app\.setName\(.*$/m, DEV_BLOCK);
      // Clean up duplicate isDev lines if the branch had a partial fix
      const lines = src.split('\n');
      const seen = new Set();
      const deduped = lines.filter(l => {
        const trimmed = l.trim();
        if (trimmed === 'const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;' ||
            trimmed === "app.setName(isDev ? 'Airport Dev' : 'Airport');") {
          if (seen.has(trimmed)) return false;
          seen.add(trimmed);
        }
        return true;
      });
      src = deduped.join('\n');
    }

    writeFileSync(mainEntry, src);
    console.log('✓ Patched src/main/index.ts with dev-mode instance separation');
  }
} catch {
  // File doesn't exist or can't be read — skip
}
