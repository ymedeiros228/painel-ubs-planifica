#!/usr/bin/env node
/**
 * Cross-platform Electron launcher.
 * On Linux, starts a private D-Bus session bus when none is available so
 * Chromium stops logging "Failed to connect to the bus" on startup.
 */
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const electron = require('electron');

const root = path.join(__dirname, '..');
const env = { ...process.env };

function ensureLinuxSessionBus() {
  if (process.platform !== 'linux') return;
  if (env.DBUS_SESSION_BUS_ADDRESS) return;
  try {
    const out = execFileSync('dbus-launch', ['--sh-syntax'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    for (const line of out.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)='([^']*)';?/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    // dbus-launch unavailable — Electron still runs; D-Bus noise may remain
  }
}

ensureLinuxSessionBus();

const electronArgs = ['.', ...process.argv.slice(2)];
// Cloud/containers frequentemente rodam como root; Chromium exige --no-sandbox.
try {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    electronArgs.push('--no-sandbox');
  }
} catch (_) {}

const child = spawn(electron, electronArgs, {
  cwd: root,
  env,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code == null ? 1 : code);
});
