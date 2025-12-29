#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const wranglerCli = path.resolve(
  projectRoot,
  'node_modules',
  'wrangler',
  'wrangler-dist',
  'cli.js'
);

if (!fs.existsSync(wranglerCli)) {
  console.error(`Wrangler CLI not found at ${wranglerCli}. Run \`npm install\` in \`web/\` first.`);
  process.exit(1);
}

const localWranglerDir = path.resolve(projectRoot, '.wrangler');
const xdgConfigHome = path.join(localWranglerDir, 'xdg-config');
const logPath = path.join(localWranglerDir, 'logs');
fs.mkdirSync(xdgConfigHome, { recursive: true });
fs.mkdirSync(logPath, { recursive: true });

const env = {
  ...process.env,
  XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || xdgConfigHome,
  WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || logPath,
};

const args = process.argv.slice(2);
if (args[0] === 'dev' || (args[0] === 'pages' && args[1] === 'dev')) {
  env.CHOKIDAR_USEPOLLING = process.env.CHOKIDAR_USEPOLLING || 'true';
  env.CHOKIDAR_INTERVAL = process.env.CHOKIDAR_INTERVAL || '1000';
}
const child = spawn(process.execPath, [wranglerCli, ...args], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
