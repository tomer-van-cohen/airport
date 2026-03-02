#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');

// Verify node-pty works before launching Electron.
// node-pty is a native C++ addon that must be compiled against Electron's
// Node ABI. If the user lacks build tools, electron-rebuild fails silently
// and node-pty won't load or won't be able to spawn a shell.
try {
  const pty = require('node-pty');
  const shell = process.platform === 'win32'
    ? process.env.COMSPEC || 'cmd.exe'
    : process.env.SHELL || '/bin/zsh';
  const test = pty.spawn(shell, [], { cols: 10, rows: 10 });
  test.kill();
} catch (err) {
  const msg = err && err.message ? err.message : String(err);
  console.error('\n\x1b[1;31mError: node-pty failed to load or spawn a shell.\x1b[0m\n');
  console.error(`  ${msg}\n`);
  console.error('This usually means native build tools are missing, so the');
  console.error('node-pty module could not be compiled for Electron.\n');
  if (process.platform === 'darwin') {
    console.error('  \x1b[1mFix:\x1b[0m  xcode-select --install');
    console.error('  Then: npx airport-ai\n');
  } else if (process.platform === 'win32') {
    console.error('  \x1b[1mFix:\x1b[0m  npm install -g windows-build-tools');
    console.error('  Then: npx airport-ai\n');
  } else {
    console.error('  \x1b[1mFix:\x1b[0m  Install gcc, g++, make, and python3');
    console.error('  Then: npx airport-ai\n');
  }
  process.exit(1);
}

// Run hook setup before launching Electron.
// When invoked via `npx airport-ai`, npm lifecycle scripts (prestart) don't
// run, so hooks never get installed into ~/.claude/settings.json.
const setupScript = path.join(__dirname, '..', 'scripts', 'setup-hooks.mjs');
try {
  execSync(`node "${setupScript}"`, { stdio: 'inherit' });
} catch { /* non-critical — hooks are optional */ }

const electronPath = require('electron');

// On macOS, stamp the Electron binary's Info.plist so the menu bar
// and Dock show "Airport" instead of the default "Electron".
if (process.platform === 'darwin') {
  const plist = path.resolve(path.dirname(electronPath), '..', 'Info.plist');
  try {
    execSync(`plutil -replace CFBundleDisplayName -string "Airport" "${plist}"`);
    execSync(`plutil -replace CFBundleName -string "Airport" "${plist}"`);
    execSync(`plutil -replace CFBundleIdentifier -string "com.airport.app" "${plist}"`);
  } catch { /* ignore — non-critical */ }
}

const child = spawn(electronPath, [path.join(__dirname, '..')], {
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code);
});
