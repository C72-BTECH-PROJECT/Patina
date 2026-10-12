const fs = require('fs');
const path = require('path');

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const logDir = path.join(projectDir, '.claude', 'logs');
const logFile = path.join(logDir, 'prompts.jsonl');

const entry = {
  timestamp: new Date().toISOString(),
  prompt: input.prompt ?? null,
};

try {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
} catch {
  // Never block the prompt on a logging failure.
}

process.exit(0);
