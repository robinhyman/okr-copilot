#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const promptsDir = path.join(repoRoot, 'docs', 'agent-prompts');
const outRoot = path.join(repoRoot, 'tmp', 'team-packets');

const task = process.argv.slice(2).join(' ').trim();
if (!task) {
  console.error('Usage: npm run team:packet -- "<task objective>"');
  process.exit(1);
}

const roles = [
  ['product-owner', 'Product owner: scope, acceptance, and increment slicing'],
  ['architect', 'Architecture guardrails, interface contracts, and risks'],
  ['ui-ux', 'UX/UI flow and interaction quality'],
  ['backend', 'API/data implementation plan and edge cases'],
  ['qa', 'Test strategy and failure-mode coverage'],
  ['release-gate', 'Go/no-go gate with evidence checklist']
];

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outRoot, ts);
fs.mkdirSync(outDir, { recursive: true });

for (const [role, intent] of roles) {
  const rolePath = path.join(promptsDir, `${role}.md`);
  const rolePrompt = fs.readFileSync(rolePath, 'utf8');
  const content = [
    '[ROLE]',
    rolePrompt.trim(),
    '',
    '[TASK]',
    task,
    '',
    `Role intent: ${intent}`,
    'Repo: okr-copilot',
    '',
    '[REQUIRED OUTPUT]',
    '- Role file + version used',
    '- What changed (or proposed change set)',
    '- Evidence/checks run (or precise checks to run)',
    '- Risks/limitations',
    '- Next action'
  ].join('\n');

  fs.writeFileSync(path.join(outDir, `${role}.prompt.md`), content);
}

const manifest = {
  createdAt: new Date().toISOString(),
  task,
  promptsDir: path.relative(repoRoot, outDir),
  roles: roles.map(([role]) => role)
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`TEAM_PACKET_READY ${path.relative(repoRoot, outDir)}`);
console.log('Next: ask Bosworth -> "spawn okr team from packet ' + path.relative(repoRoot, outDir) + '"');
