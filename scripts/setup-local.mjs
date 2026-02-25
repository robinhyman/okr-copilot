#!/usr/bin/env node
import { execSync } from 'node:child_process';

const run = (command, options = {}) => {
  execSync(command, { stdio: 'inherit', ...options });
};

const capture = (command) => {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const ensureCommand = (name) => {
  const version = capture(`${name} --version`);
  if (!version) {
    throw new Error(`Missing required command: ${name}`);
  }
  return version;
};

const nodeVersion = process.version;
const npmVersion = ensureCommand('npm');
const npxVersion = ensureCommand('npx');

const npmMajor = Number((npmVersion.match(/\d+/) || ['0'])[0]);
const npxMajor = Number((npxVersion.match(/\d+/) || ['0'])[0]);

console.log('\n🔎 Local toolchain check');
console.log(`- node: ${nodeVersion}`);
console.log(`- npm:  v${npmVersion}`);
console.log(`- npx:  v${npxVersion}`);

if (npmMajor !== npxMajor) {
  console.warn('\n⚠️ npm and npx major versions differ.');
  console.warn('   This can happen in WSL when global paths are mixed.');
  console.warn('   Prefer using Node from one environment (WSL OR Windows), then reopen your shell.\n');
}

console.log('📦 Installing dependencies...');
run('npm install');

console.log('\n🗄️ Running API migrations...');
run('npm run migrate');

console.log('\n✅ Local setup complete. Next: npm run dev\n');
