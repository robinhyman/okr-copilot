#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:4000}"
AUTH_TOKEN="${AUTH_TOKEN:-dev-stub-token}"

seed_team() {
  local user_id="$1"
  local team_id="$2"
  local payload="$3"

  echo "[seed-demo] seeding ${team_id} as ${user_id}"
  response=$(curl -sS -X POST "${API_BASE_URL}/api/okrs/bulk-upsert" \
    -H 'Content-Type: application/json' \
    -H "x-auth-stub-token: ${AUTH_TOKEN}" \
    -H "x-auth-user-id: ${user_id}" \
    -H "x-auth-team-id: ${team_id}" \
    -d "$payload")

  kr_ids=$(python3 - "$response" <<'PY'
import json,sys
raw=sys.argv[1]
obj=json.loads(raw)
if not obj.get('ok'):
    print(raw)
    raise SystemExit(1)
okrs=obj.get('okrs',[])
kr_count=sum(len(o.get('keyResults',[])) for o in okrs)
print(f"[seed-demo] OK: objectives={len(okrs)} totalKRs={kr_count}", file=sys.stderr)
ids=[]
for okr in okrs:
    for kr in okr.get('keyResults',[])[:2]:
        ids.append(str(kr.get('id')))
print(' '.join([i for i in ids if i and i != 'None']))
PY
)

  for kr_id in ${kr_ids}; do
    curl -sS -X POST "${API_BASE_URL}/api/key-results/${kr_id}/checkins" \
      -H 'Content-Type: application/json' \
      -H "x-auth-stub-token: ${AUTH_TOKEN}" \
      -H "x-auth-user-id: ${user_id}" \
      -H "x-auth-team-id: ${team_id}" \
      -d '{"value":1,"note":"Seeded demo check-in"}' >/dev/null
  done
}

seed_draft() {
  local user_id="$1"
  local team_id="$2"
  local title="$3"
  local objective="$4"

  session=$(curl -sS -X POST "${API_BASE_URL}/api/okr-drafts/sessions" \
    -H 'Content-Type: application/json' \
    -H "x-auth-stub-token: ${AUTH_TOKEN}" \
    -H "x-auth-user-id: ${user_id}" \
    -H "x-auth-team-id: ${team_id}" \
    -d "{\"title\":\"${title}\"}")

  draft_id=$(python3 - "$session" <<'PY'
import json,sys
obj=json.loads(sys.argv[1])
print(obj.get('session',{}).get('id',''))
PY
)

  curl -sS -X POST "${API_BASE_URL}/api/okr-drafts/${draft_id}/versions" \
    -H 'Content-Type: application/json' \
    -H "x-auth-stub-token: ${AUTH_TOKEN}" \
    -H "x-auth-user-id: ${user_id}" \
    -H "x-auth-team-id: ${team_id}" \
    -d "{\"status\":\"ready\",\"summary\":\"seeded demo draft\",\"draft\":{\"objective\":\"${objective}\",\"timeframe\":\"Q3 2026\",\"keyResults\":[{\"title\":\"Increase weekly metric from 10 to 18\",\"targetValue\":18,\"currentValue\":10,\"unit\":\"%\"},{\"title\":\"Reduce cycle time from 9 to 5\",\"targetValue\":5,\"currentValue\":9,\"unit\":\"days\"}]}}" >/dev/null
}

payload_product='{"objectives":[{"objective":"Improve product delivery speed and quality","timeframe":"Q3 2026","keyResults":[{"title":"Increase release frequency from 2 to 4","targetValue":4,"currentValue":2,"unit":"releases/month"},{"title":"Reduce cycle time from 20 to 12","targetValue":12,"currentValue":20,"unit":"days"},{"title":"Reduce escaped defects from 8 to 4","targetValue":4,"currentValue":8,"unit":"%"}]},{"objective":"Strengthen platform reliability","timeframe":"Q3 2026","keyResults":[{"title":"Increase uptime from 99.5 to 99.9","targetValue":99.9,"currentValue":99.5,"unit":"%"},{"title":"Reduce P95 API latency from 620 to 350","targetValue":350,"currentValue":620,"unit":"ms"},{"title":"Reduce Sev1 incidents from 5 to 1","targetValue":1,"currentValue":5,"unit":"incidents/quarter"}]}]}'

payload_sales='{"objectives":[{"objective":"Grow qualified pipeline and conversion","timeframe":"Q3 2026","keyResults":[{"title":"Increase weekly SQLs from 12 to 20","targetValue":20,"currentValue":12,"unit":"SQLs/week"},{"title":"Increase trial-to-paid conversion from 14 to 20","targetValue":20,"currentValue":14,"unit":"%"},{"title":"Increase win rate from 22 to 30","targetValue":30,"currentValue":22,"unit":"%"}]},{"objective":"Raise expansion efficiency","timeframe":"Q3 2026","keyResults":[{"title":"Increase average deal size from 1800 to 2500","targetValue":2500,"currentValue":1800,"unit":"GBP"},{"title":"Reduce CAC from 320 to 250","targetValue":250,"currentValue":320,"unit":"GBP"},{"title":"Raise lead response SLA from 62 to 90","targetValue":90,"currentValue":62,"unit":"%"}]}]}'

payload_ops='{"objectives":[{"objective":"Reduce support turnaround","timeframe":"Q3 2026","keyResults":[{"title":"Cut median response time from 7 to 4","targetValue":4,"currentValue":7,"unit":"hours"},{"title":"Reduce backlog older than 3 days from 42 to 15","targetValue":15,"currentValue":42,"unit":"tickets"},{"title":"Increase first-contact resolution from 58 to 72","targetValue":72,"currentValue":58,"unit":"%"}]},{"objective":"Improve process resilience","timeframe":"Q3 2026","keyResults":[{"title":"Document top 10 runbooks","targetValue":10,"currentValue":3,"unit":"runbooks"},{"title":"Reduce incident reopen rate from 14 to 8","targetValue":8,"currentValue":14,"unit":"%"},{"title":"Automate repetitive ops workflows from 2 to 6","targetValue":6,"currentValue":2,"unit":"automations"}]}]}'

seed_team "mgr_product" "team_product" "$payload_product"
seed_team "mgr_sales" "team_sales" "$payload_sales"
seed_team "mgr_ops" "team_ops" "$payload_ops"

seed_draft "mgr_product" "team_product" "Product draft · coach" "Improve product reliability and release confidence"
seed_draft "mgr_sales" "team_sales" "Sales draft · coach" "Improve sales pipeline quality and conversion"
seed_draft "mgr_ops" "team_ops" "Ops draft · coach" "Reduce support turnaround and escalation risk"

echo "[seed-demo] done"