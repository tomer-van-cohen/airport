#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const spawnDir = process.env.AIRPORT_SPAWN_DIR;
if (!spawnDir) {
  process.stderr.write('Error: AIRPORT_SPAWN_DIR is not set. This script must be run from within an Airport terminal session.\n');
  process.exit(1);
}

if (!fs.existsSync(spawnDir)) {
  process.stderr.write('Error: Spawn directory ' + spawnDir + ' does not exist. Is Airport running?\n');
  process.exit(1);
}

const args = process.argv.slice(2);
let cwd = '';
let title = '';
let command = '';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--cwd':
      cwd = args[++i] || '';
      break;
    case '--title':
      title = args[++i] || '';
      break;
    case '--command':
      command = args[++i] || '';
      break;
    default:
      process.stderr.write('Unknown option: ' + args[i] + '\n');
      process.stderr.write('Usage: airport-spawn [--cwd DIR] [--title TITLE] [--command CMD]\n');
      process.exit(1);
  }
}

const payload = {};
if (cwd) payload.cwd = cwd;
if (title) payload.title = title;
if (command) payload.command = command;

const timestamp = Math.floor(Date.now() / 1000);
const spawnFile = path.join(spawnDir, timestamp + '-' + process.pid + '.spawn');
fs.writeFileSync(spawnFile, JSON.stringify(payload));
