#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 5 || $# -gt 7 ]]; then
  printf 'usage: composio-proxy.sh COLLECTION TEAM_ID BINDING_ID METHOD PATH [BODY_JSON|@FILE|-] [QUERY_JSON]\n' >&2
  exit 2
fi

collection=$1
team_id=$2
binding_id=$3
method=$(printf '%s' "$4" | tr '[:lower:]' '[:upper:]')
provider_path=$5
body=${6-}
query=${7-}

case "$collection" in
  linear-workspaces | jira-sites | asana-accounts | sentry-accounts | gitlab-bindings | cloudflare-accounts | slack-integrations) ;;
  *)
    printf 'Unsupported Composio connector collection: %s\n' "$collection" >&2
    exit 2
    ;;
esac
if [[ ! "$team_id" =~ ^[a-fA-F0-9]{24}$ ]]; then
  printf 'Cerin team id must be a 24-character hexadecimal id\n' >&2
  exit 2
fi
if [[ "$collection" == cloudflare-accounts ]]; then
  if [[ ! "$binding_id" =~ ^[a-fA-F0-9]{32}$ ]]; then
    printf 'Cloudflare account id must be a 32-character hexadecimal id\n' >&2
    exit 2
  fi
elif [[ ! "$binding_id" =~ ^[a-fA-F0-9]{24}$ ]]; then
  printf 'Connector binding id must be a 24-character hexadecimal id\n' >&2
  exit 2
fi
: "${CERIN_SESSION_ID:?Cerin session id is unavailable}"
if [[ ! "$CERIN_SESSION_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  printf 'Cerin session id has an invalid format\n' >&2
  exit 2
fi
if [[ "$provider_path" != /* || "$provider_path" == //* || "$provider_path" == *'?'* || "$provider_path" == *'#'* || "$provider_path" == *'\'* ]]; then
  printf 'Provider path must be relative and must not contain a query or fragment\n' >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
request_file=$(mktemp)
input_file=$(mktemp)
trap 'rm -f "$request_file" "$input_file"' EXIT
if [[ "$body" == "-" ]]; then
  cat >"$input_file"
  body="@$input_file"
fi
python3 - "$request_file" "$method" "$provider_path" "$body" "$query" <<'PY'
import json
import pathlib
import sys

output, method, path, raw_body, raw_query = sys.argv[1:]

def decode(raw):
    if raw == "-":
        value = json.load(sys.stdin)
    elif raw.startswith("@"):
        value = json.loads(pathlib.Path(raw[1:]).read_text())
    else:
        value = json.loads(raw)
    return value

payload = {"method": method, "path": path}
if raw_body:
    payload["body"] = decode(raw_body)
if raw_query:
    query = decode(raw_query)
    if not isinstance(query, dict) or not all(
        isinstance(key, str) and isinstance(value, str) for key, value in query.items()
    ):
        raise ValueError("query must be a JSON object with string values")
    payload["query"] = query
pathlib.Path(output).write_text(json.dumps(payload))
PY

response=$(bash "$script_dir/cerin-api.sh" POST \
  "/agent-sessions/$CERIN_SESSION_ID/teams/$team_id/$collection/$binding_id/proxy" \
  "@$request_file")
python3 - "$response" <<'PY'
import json
import sys

result = json.loads(sys.argv[1])
status = result.get("status")
data = result.get("data")
rendered = json.dumps(data, ensure_ascii=False, indent=2)
if not isinstance(status, int) or not 200 <= status < 300:
    print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
    raise SystemExit(1)
print(rendered)
PY
