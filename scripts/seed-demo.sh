#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:4000}"
AUTH_TOKEN="${AUTH_TOKEN:-dev-stub-token}"

payload='{
  "objectives": [
    {
      "objective": "Improve product delivery speed and quality",
      "timeframe": "Q3 2026",
      "keyResults": [
        {"title": "Increase release frequency from 2 to 4", "targetValue": 4, "currentValue": 2, "unit": "releases/month"},
        {"title": "Reduce cycle time from 20 to 12", "targetValue": 12, "currentValue": 20, "unit": "days"},
        {"title": "Reduce escaped defects from 8 to 4", "targetValue": 4, "currentValue": 8, "unit": "%"},
        {"title": "Increase feature adoption from 35 to 55", "targetValue": 55, "currentValue": 35, "unit": "%"},
        {"title": "Increase engineering NPS from 32 to 45", "targetValue": 45, "currentValue": 32, "unit": "score"}
      ]
    },
    {
      "objective": "Grow qualified pipeline and conversion",
      "timeframe": "Q3 2026",
      "keyResults": [
        {"title": "Increase weekly SQLs from 12 to 20", "targetValue": 20, "currentValue": 12, "unit": "SQLs/week"},
        {"title": "Increase trial-to-paid conversion from 14 to 20", "targetValue": 20, "currentValue": 14, "unit": "%"},
        {"title": "Reduce CAC from 320 to 250", "targetValue": 250, "currentValue": 320, "unit": "GBP"},
        {"title": "Increase win rate from 22 to 30", "targetValue": 30, "currentValue": 22, "unit": "%"},
        {"title": "Increase average deal size from 1800 to 2500", "targetValue": 2500, "currentValue": 1800, "unit": "GBP"}
      ]
    },
    {
      "objective": "Improve activation and retention",
      "timeframe": "Q3 2026",
      "keyResults": [
        {"title": "Increase day-7 activation from 42 to 55", "targetValue": 55, "currentValue": 42, "unit": "%"},
        {"title": "Increase day-30 retention from 28 to 38", "targetValue": 38, "currentValue": 28, "unit": "%"},
        {"title": "Reduce onboarding drop-off from 37 to 22", "targetValue": 22, "currentValue": 37, "unit": "%"},
        {"title": "Increase completed onboarding from 63 to 78", "targetValue": 78, "currentValue": 63, "unit": "%"},
        {"title": "Increase weekly active teams from 54 to 75", "targetValue": 75, "currentValue": 54, "unit": "teams"}
      ]
    },
    {
      "objective": "Raise customer value and satisfaction",
      "timeframe": "Q3 2026",
      "keyResults": [
        {"title": "Increase CSAT from 4.1 to 4.5", "targetValue": 4.5, "currentValue": 4.1, "unit": "/5"},
        {"title": "Reduce first response time from 9 to 4", "targetValue": 4, "currentValue": 9, "unit": "hours"},
        {"title": "Increase self-serve resolution from 24 to 40", "targetValue": 40, "currentValue": 24, "unit": "%"},
        {"title": "Reduce churn from 6.8 to 4.5", "targetValue": 4.5, "currentValue": 6.8, "unit": "%"},
        {"title": "Increase expansion revenue from 12000 to 18000", "targetValue": 18000, "currentValue": 12000, "unit": "GBP/month"}
      ]
    },
    {
      "objective": "Strengthen platform reliability",
      "timeframe": "Q3 2026",
      "keyResults": [
        {"title": "Increase uptime from 99.5 to 99.9", "targetValue": 99.9, "currentValue": 99.5, "unit": "%"},
        {"title": "Reduce P95 API latency from 620 to 350", "targetValue": 350, "currentValue": 620, "unit": "ms"},
        {"title": "Reduce Sev1 incidents from 5 to 1", "targetValue": 1, "currentValue": 5, "unit": "incidents/quarter"},
        {"title": "Increase test coverage from 58 to 75", "targetValue": 75, "currentValue": 58, "unit": "%"},
        {"title": "Reduce failed deployments from 9 to 3", "targetValue": 3, "currentValue": 9, "unit": "deployments/month"}
      ]
    }
  ]
}'

echo "[seed-demo] posting 5 objectives x 5 KRs to ${API_BASE_URL}/api/okrs/bulk-upsert"
response=$(curl -sS -X POST "${API_BASE_URL}/api/okrs/bulk-upsert" \
  -H 'Content-Type: application/json' \
  -H "x-auth-stub-token: ${AUTH_TOKEN}" \
  -d "$payload")

python3 - "$response" <<'PY'
import json,sys
raw=sys.argv[1]
obj=json.loads(raw)
if not obj.get('ok'):
    print(raw)
    raise SystemExit(1)
okrs=obj.get('okrs',[])
kr_count=sum(len(o.get('keyResults',[])) for o in okrs)
print(f"[seed-demo] OK: objectives={len(okrs)} totalKRs={kr_count}")
PY

echo "[seed-demo] done"
