#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
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
