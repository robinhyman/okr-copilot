#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { gateConfigFromEnv, printSummary, runOperationalChecks } from './lib/quality-gates.mjs';

function run(command, args, label) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code) => resolve({ label, ok: code === 0, code: code ?? 1 }));
  });
}

async function waitForHealth(url, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

async function main() {
  const commandChecks = [];

  commandChecks.push(await run('npm', ['run', 'migrate'], 'migrate'));

  const api = spawn('npm', ['exec', '-w', '@okr-copilot/api', 'tsx', 'src/index.ts'], {
    stdio: 'inherit',
    shell: false
  });

  try {
    const healthy = await waitForHealth(`${process.env.API_BASE_URL || 'http://127.0.0.1:4000'}/health`);
    if (!healthy) {
      commandChecks.push({ label: 'api_health', ok: false, code: 1 });
      const ok = printSummary('demo:prepare command checks', commandChecks.map((c) => ({ name: c.label, ok: c.ok, detail: `exit=${c.code}` })));
      process.exit(ok ? 0 : 1);
    }
    commandChecks.push({ label: 'api_health', ok: true, code: 0 });

    commandChecks.push(await run('npm', ['run', 'seed:demo'], 'seed:demo'));

    const operationalChecks = await runOperationalChecks();
    const commandOk = printSummary('demo:prepare command checks', commandChecks.map((c) => ({ name: c.label, ok: c.ok, detail: `exit=${c.code}` })));
    const verificationOk = printSummary('demo:prepare verification checks', operationalChecks);
    const strict = gateConfigFromEnv().strict;

    if (commandOk && (verificationOk || !strict)) {
      if (!verificationOk && !strict) {
        console.log('DEMO_PREPARE: PASS (non-strict mode: verification warnings tolerated)');
      } else {
        console.log('DEMO_PREPARE: PASS');
      }
      process.exit(0);
    }

    console.log('DEMO_PREPARE: FAIL');
    process.exit(1);
  } finally {
    api.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('[demo:prepare] fatal', error);
  process.exit(1);
});
