#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { gateConfigFromEnv, printSummary, runOperationalChecks } from './lib/quality-gates.mjs';

function run(command, args, label) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code) => resolve({ label, ok: code === 0, code: code ?? 1 }));
  });
}

async function main() {
  const results = [];
  results.push(await run('npm', ['run', 'typecheck'], 'typecheck'));
  results.push(await run('npm', ['run', 'build'], 'build'));
  results.push(await run('npm', ['test'], 'test'));
  results.push(await run('npm', ['run', 'demo:prepare'], 'demo:prepare'));

  const acceptanceChecks = await runOperationalChecks();

  const commandOk = printSummary('release:gate command checks', results.map((r) => ({ name: r.label, ok: r.ok, detail: `exit=${r.code}` })));
  const acceptanceOk = printSummary('release:gate acceptance checks', acceptanceChecks);
  const strict = gateConfigFromEnv().strict;

  if (commandOk && (acceptanceOk || !strict)) {
    if (!acceptanceOk && !strict) {
      console.log('RELEASE_GATE: PASS (non-strict mode: acceptance warnings tolerated)');
    } else {
      console.log('RELEASE_GATE: PASS');
    }
    process.exit(0);
  }

  console.log('RELEASE_GATE: FAIL');
  process.exit(1);
}

main().catch((error) => {
  console.error('[release:gate] fatal', error);
  process.exit(1);
});
