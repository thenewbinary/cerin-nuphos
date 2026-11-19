#!/usr/bin/env bash
# Runs one Gmail, Google Drive or Google Calendar tool through the session owner's Composio
# connection and prints Composio's JSON answer ({successful, data, error}).
set -euo pipefail
if [[ -n "${OPENAB_CREDENTIALS_DIR:-}" ]]; then
  CERIN_TOKEN=$(cat "$OPENAB_CREDENTIALS_DIR/CERIN_TOKEN" 2>/dev/null || true)
  export CERIN_TOKEN
fi

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: composio.sh <teamId> <GMAIL_…|GOOGLEDRIVE_…|GOOGLECALENDAR_… tool> ['<arguments JSON>']" >&2
  exit 2
fi
if [ -z "${CERIN_TOKEN:-}" ]; then
  echo "CERIN_TOKEN is not set; this only works inside a Cerin agent conversation" >&2
  exit 1
fi

base="${CERIN_BACKEND_URL:-${CERIN_API_URL:-https://platform.cerin.ai}}"
team_enc="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1")"
body="$(python3 -c 'import json, sys; print(json.dumps({"tool": sys.argv[1], "arguments": json.loads(sys.argv[2])}))' "$2" "${3:-{\}}")"

curl -sS --fail-with-body --max-time 120 \
  -H @<(printf 'Authorization: Bearer %s\n' "${CERIN_TOKEN}") \
  -H "Content-Type: application/json" \
  -d "$body" \
  "${base%/}/teams/${team_enc}/composio/execute"
echo
