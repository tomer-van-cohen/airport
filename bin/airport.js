#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const electronPath = require('electron');

const child = spawn(electronPath, [path.join(__dirname, '..')], {
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code);
});
