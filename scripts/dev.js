const { spawn } = require('node:child_process');
const path = require('node:path');

const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  children.forEach((child) => { if (child.exitCode === null) child.kill(); });
}

for (const directory of ['backend', 'frontend']) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..', directory),
    stdio: 'inherit',
    env: process.env
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Failed to start ${directory}:`, error.message);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.log(`${directory} stopped${signal ? ` (${signal})` : ''}. Stopping both applications.`);
      stop(code === null ? 1 : code);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
