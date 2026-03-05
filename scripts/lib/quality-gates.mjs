import fs from 'node:fs';
import path from 'node:path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.AUTH_STUB_TOKEN || 'dev-stub-token';

function boolFromEnv(value, fallback) {
  if (value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function gateConfigFromEnv(env = process.env) {
  return {
    strict: boolFromEnv(env.DEMO_STRICT_GATES, true),
    coachLlmRequired: boolFromEnv(env.COACH_LLM_REQUIRED, false),
    openAiKeyPresent: Boolean((env.OPENAI_API_KEY || '').trim())
  };
}

async function apiGet(pathname, userId, teamId) {
  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: {
      'x-auth-stub-token': AUTH_TOKEN,
      'x-auth-user-id': userId,
      'x-auth-team-id': teamId
    }
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiPost(pathname, userId, teamId, payload) {
  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auth-stub-token': AUTH_TOKEN,
      'x-auth-user-id': userId,
      'x-auth-team-id': teamId
    },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function pass(name, detail) {
  return { name, ok: true, detail };
}

function fail(name, detail) {
  return { name, ok: false, detail };
}

export async function runOperationalChecks() {
  const checks = [];
  const cfg = gateConfigFromEnv();

  const okrsRes = await apiGet('/api/okrs', 'mgr_product', 'team_product');
  if (okrsRes.status !== 200 || !Array.isArray(okrsRes.body?.okrs)) {
    checks.push(fail('domain_data.okrs', `GET /api/okrs status=${okrsRes.status}`));
  } else {
    const okrs = okrsRes.body.okrs;
    const krs = okrs.flatMap((o) => Array.isArray(o?.keyResults) ? o.keyResults : []);
    if (okrs.length === 0) checks.push(fail('domain_data.okrs', 'No OKRs found'));
    else checks.push(pass('domain_data.okrs', `OKRs=${okrs.length}`));

    if (krs.length === 0) {
      checks.push(fail('domain_data.krs', 'No key results found'));
    } else {
      checks.push(pass('domain_data.krs', `KRs=${krs.length}`));
      const firstKrId = krs[0]?.id;
      const checkinsRes = await apiGet(`/api/key-results/${firstKrId}/checkins?limit=50`, 'mgr_product', 'team_product');
      const checkins = checkinsRes.body?.checkins || [];
      if (checkinsRes.status !== 200 || !Array.isArray(checkins) || checkins.length === 0) {
        checks.push(fail('domain_data.checkins', `No check-ins for KR ${firstKrId}`));
      } else {
        checks.push(pass('domain_data.checkins', `KR ${firstKrId} check-ins=${checkins.length}`));
      }
    }
  }

  const managerDigestRes = await apiGet('/api/manager/digest', 'mgr_product', 'team_product');
  const managerItems = managerDigestRes.body?.digest?.items;
  if (managerDigestRes.status === 200 && Array.isArray(managerItems) && managerItems.length > 0) {
    checks.push(pass('overview.manager_digest', `items=${managerItems.length}`));
  } else {
    checks.push(fail('overview.manager_digest', `status=${managerDigestRes.status}, items=${Array.isArray(managerItems) ? managerItems.length : 'n/a'}`));
  }

  const leaderRollupRes = await apiGet('/api/leader/rollup', 'leader_exec', 'team_product');
  const leaderTeams = leaderRollupRes.body?.rollup?.teams;
  if (leaderRollupRes.status === 200 && Array.isArray(leaderTeams) && leaderTeams.length > 0) {
    checks.push(pass('overview.leader_rollup', `teams=${leaderTeams.length}`));
  } else {
    checks.push(fail('overview.leader_rollup', `status=${leaderRollupRes.status}, teams=${Array.isArray(leaderTeams) ? leaderTeams.length : 'n/a'}`));
  }

  const sessionRes = await apiPost('/api/okr-drafts/sessions', 'mgr_product', 'team_product', { title: 'Gate verification draft' });
  const sessionId = sessionRes.body?.session?.id;
  if (sessionRes.status !== 201 || !sessionId) {
    checks.push(fail('coach.metadata_source', `Unable to create session status=${sessionRes.status}`));
  } else {
    const chatRes = await apiPost(`/api/okr-drafts/${sessionId}/chat`, 'mgr_product', 'team_product', {
      messages: [{ role: 'user', content: 'Help me create measurable OKRs for Q3.' }]
    });
    const source = chatRes.body?.metadata?.source;
    if (chatRes.status !== 200 || !source) {
      checks.push(fail('coach.metadata_source', `status=${chatRes.status}, source=${String(source)}`));
    } else {
      checks.push(pass('coach.metadata_source', `source=${source}`));
      if (cfg.coachLlmRequired) {
        if (!cfg.openAiKeyPresent) {
          checks.push(fail('coach.llm_required_config', 'COACH_LLM_REQUIRED=true but OPENAI_API_KEY missing'));
        }
        if (source !== 'llm') {
          checks.push(fail('coach.llm_required_source', `COACH_LLM_REQUIRED=true but source=${source}`));
        } else {
          checks.push(pass('coach.llm_required_source', 'source=llm'));
        }
      }
    }
  }

  const providerPath = path.resolve('apps/api/src/services/ai/okr-draft-provider.ts');
  const providerSource = fs.readFileSync(providerPath, 'utf8');
  const antiLoopPresent = providerSource.includes('ensureNonLoopingAssistantMessage');
  if (antiLoopPresent) checks.push(pass('coach.anti_loop_guard', 'ensureNonLoopingAssistantMessage found'));
  else checks.push(fail('coach.anti_loop_guard', 'Missing duplicate consecutive assistant guard in provider'));

  const testPath = path.resolve('apps/api/src/tests/okrs.integration.test.ts');
  const testSource = fs.readFileSync(testPath, 'utf8');
  if (testSource.includes('coach anti-loop guard prevents consecutive duplicate assistant prompts')) {
    checks.push(pass('coach.anti_loop_test', 'anti-loop integration test present'));
  } else {
    checks.push(fail('coach.anti_loop_test', 'anti-loop integration test missing'));
  }

  return checks;
}

export function printSummary(title, checks) {
  console.log(`\n=== ${title} ===`);
  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} | ${check.name} | ${check.detail}`);
  }
  const failures = checks.filter((check) => !check.ok).length;
  console.log(`Summary: ${checks.length - failures} passed, ${failures} failed`);
  return failures === 0;
}
