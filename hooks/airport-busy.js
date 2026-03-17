#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

if (!process.env.AIRPORT || !process.env.AIRPORT_STATUS_FILE) process.exit(0);
const statusFile = process.env.AIRPORT_STATUS_FILE;

// Read stdin (hook JSON)
let input = '';
try {
  input = fs.readFileSync(0, 'utf-8').trim();
} catch {
  // no stdin
}

if (!input) {
  fs.writeFileSync(statusFile, 'busy;Thinking');
  process.exit(0);
}

let data;
try {
  data = JSON.parse(input);
} catch {
  fs.writeFileSync(statusFile, 'busy;Thinking');
  process.exit(0);
}

const tool = data.tool_name || '';
const ti = data.tool_input || {};

if (!tool) {
  // UserPromptSubmit — no tool_name, extract prompt preview
  const prompt = data.prompt || '';
  if (prompt) {
    const firstLine = prompt.split('\n')[0];
    let short = firstLine.slice(0, 50);
    if (short.length < prompt.length) short += '\u2026';
    fs.writeFileSync(statusFile, 'busy;Thinking about: ' + short);
  } else {
    fs.writeFileSync(statusFile, 'busy;Thinking');
  }
  process.exit(0);
}

let desc;

switch (tool) {
  case 'Read': {
    const fp = ti.file_path || '';
    desc = fp ? 'Reading `' + path.basename(fp) + '`' : 'Reading files';
    break;
  }
  case 'Glob': {
    const pat = ti.pattern || '';
    desc = pat ? 'Searching for `' + pat + '`' : 'Searching files';
    break;
  }
  case 'Grep': {
    const pat = ti.pattern || '';
    desc = pat ? 'Searching for `' + pat + '`' : 'Searching code';
    break;
  }
  case 'Write': {
    const fp = ti.file_path || '';
    if (fp) {
      desc = 'Writing `' + path.basename(fp) + '`';
      // Capture plan file path for Airport
      if ((fp.includes('/.claude/plans/') || fp.includes('\\.claude\\plans\\')) && fp.endsWith('.md')) {
        const planFile = statusFile.replace(/\.status$/, '.plan');
        fs.writeFileSync(planFile, fp);
      }
    } else {
      desc = 'Writing file';
    }
    break;
  }
  case 'Edit': {
    const fp = ti.file_path || '';
    desc = fp ? 'Editing `' + path.basename(fp) + '`' : 'Editing file';
    break;
  }
  case 'NotebookEdit': {
    const fp = ti.notebook_path || '';
    desc = fp ? 'Editing `' + path.basename(fp) + '`' : 'Editing notebook';
    break;
  }
  case 'Bash': {
    const cmd = ti.command || '';
    if (cmd) {
      const firstLine = cmd.split('\n')[0];
      let short = firstLine.slice(0, 60);
      if (short.length < cmd.length) short += '\u2026';
      desc = 'Running `' + short + '`';
    } else {
      desc = 'Running command';
    }
    break;
  }
  case 'WebSearch': {
    const q = ti.query || '';
    desc = q ? 'Searching web for `' + q + '`' : 'Searching web';
    break;
  }
  case 'WebFetch': {
    const url = ti.url || '';
    desc = url ? 'Fetching `' + url + '`' : 'Fetching URL';
    break;
  }
  case 'Task': {
    const d = ti.description || '';
    desc = d ? 'Running agent: ' + d : 'Running agent';
    break;
  }
  default:
    desc = tool;
    break;
}

fs.writeFileSync(statusFile, 'busy;' + desc);
