#!/usr/bin/env bash
set -euo pipefail

# Usage:
# GRAFANA_HOST (optional, default http://localhost:3000)
# GRAFANA_API_KEY (optional; prefer for auth)
# Example:
# GRAFANA_HOST="https://grafana.example.com" GRAFANA_API_KEY="xxx" ./scripts/validate-grafana-import.sh

GRAFANA_HOST=${GRAFANA_HOST:-http://localhost:3000}
QUERY="Lipana Reconciliation"
ENCODED_QUERY=$(printf "%s" "$QUERY" | jq -s -R -r @uri)

# Choose auth header if API key present
AUTH_HEADER=""
if [ -n "${GRAFANA_API_KEY:-}" ]; then
  AUTH_HEADER="Authorization: Bearer ${GRAFANA_API_KEY}"
fi

echo "Querying Grafana at $GRAFANA_HOST for dashboard: $QUERY"

set +e
HTTP_RAW=$(curl -sS -w "\n%{http_code}" -H "Accept: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} "$GRAFANA_HOST/api/search?query=$ENCODED_QUERY")
RC=$?
set -e

if [ $RC -ne 0 ]; then
  echo "ERROR: curl failed with exit $RC"
  exit 2
fi

HTTP_BODY=$(printf "%s" "$HTTP_RAW" | sed '$d')
HTTP_STATUS=$(printf "%s" "$HTTP_RAW" | tail -n1)

echo "HTTP status: $HTTP_STATUS"

if [ "$HTTP_STATUS" != "200" ]; then
  echo "Unexpected HTTP status: $HTTP_STATUS"
  echo "Body: $HTTP_BODY"
  exit 1
fi

# Count results
COUNT=$(printf "%s" "$HTTP_BODY" | jq 'length')
if [ "$COUNT" -gt 0 ]; then
  echo "FOUND: $COUNT result(s)"
  printf "%s\n" "$HTTP_BODY" | jq -r '.[] | "- [\(.type)] \(.title) (uid=\(.uid // "-") )"'
  exit 0
else
  echo "NOT FOUND: no dashboard matching '$QUERY'"
  exit 1
fi
