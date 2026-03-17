#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

if (!process.env.AIRPORT || !process.env.AIRPORT_STATUS_FILE) process.exit(0);
const statusFile = process.env.AIRPORT_STATUS_FILE;

// Read the last busy message so we can show "X — finished"
let last = '';
try {
  const content = fs.readFileSync(statusFile, 'utf-8').trim();
  if (content.startsWith('busy;')) {
    last = content.slice(5);
  }
} catch {
  // file doesn't exist or can't be read
}

if (last) {
  fs.writeFileSync(statusFile, 'done;' + last + ' \u2014 finished');
} else {
  fs.writeFileSync(statusFile, 'done;Finished');
}

// Check for plan files created during this session.
// Claude Code's plan mode writes to ~/.claude/plans/ internally (not via Write tool),
// so the busy hook won't catch them. Scan for recently modified plan files.
const planFile = statusFile.replace(/\.status$/, '.plan');
try {
  fs.accessSync(planFile);
  // Plan file already exists — skip scan
} catch {
  const plansDir = path.join(os.homedir(), '.claude', 'plans');
  try {
    const entries = fs.readdirSync(plansDir);
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    let newest = null;
    let newestMtime = 0;

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const fullPath = path.join(plansDir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && stat.mtimeMs >= fiveMinAgo && stat.mtimeMs > newestMtime) {
          newest = fullPath;
          newestMtime = stat.mtimeMs;
        }
      } catch {
        // skip inaccessible files
      }
    }

    if (newest) {
      fs.writeFileSync(planFile, newest);
    }
  } catch {
    // plans dir doesn't exist — skip
  }
}
