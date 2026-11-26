#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'usage: graphql.sh CERIN_TEAM_ID BINDING_ID [GRAPHQL_JSON|@FILE|-]\n' >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
response=$(mktemp)
trap 'rm -f "$response"' EXIT
bash "$script_dir/proxy.sh" "$1" "$2" POST /graphql "${3:--}" >"$response"
python3 - "$response" <<'PY'
import json
import pathlib
import sys

result = json.loads(pathlib.Path(sys.argv[1]).read_text())
if result.get("errors"):
    print(json.dumps({"errors": result["errors"]}, ensure_ascii=False, indent=2), file=sys.stderr)
    raise SystemExit(1)
print(json.dumps(result, ensure_ascii=False, indent=2))
PY
