#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${OPENAB_CREDENTIALS_DIR:-}" ]]; then
  CERIN_TOKEN=$(cat "$OPENAB_CREDENTIALS_DIR/CERIN_TOKEN" 2>/dev/null || true)
  export CERIN_TOKEN
fi

usage() {
  cat >&2 <<EOF
Usage: setup-credentials.sh <teamId> <accountId>

Fetches Cloudflare API credentials from Cerin backend (using the user's
CERIN_TOKEN) for an Cerin-bound account, then writes a private env file at
~/.cloudflare/cerin.env for later curl/API calls.

Arguments:
  teamId     Cerin team id (24-char hex)
  accountId  Cloudflare account id (32-char hex) bound to the team

Required env: CERIN_TOKEN. Optional env: CERIN_BACKEND_URL (defaults to https://platform.cerin.ai).
EOF
  exit 1
}

if [ "$#" -lt 2 ]; then usage; fi

team_id="$1"
account_id="$2"

if [ -z "${CERIN_TOKEN:-}" ]; then
  echo "CERIN_TOKEN is not set in this sandbox" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to parse the credentials response" >&2
  exit 1
fi

base="${CERIN_BACKEND_URL:-https://platform.cerin.ai}"
base="${base%/}"
url="${base}/teams/${team_id}/cloudflare-accounts/${account_id}/credentials"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

http_code="$(curl -sS -o "$tmp" -w '%{http_code}' \
  -H @<(printf 'Authorization: Bearer %s\n' "${CERIN_TOKEN}") \
  -H 'Accept: application/json' \
  "$url")"

if [ "$http_code" != "200" ]; then
  echo "Cerin backend returned HTTP ${http_code} for ${url}:" >&2
  cat "$tmp" >&2
  echo >&2
  exit 1
fi

mkdir -p "$HOME/.cloudflare"
chmod 700 "$HOME/.cloudflare"

python3 - "$tmp" "$HOME/.cloudflare/cerin.env" <<'PY'
import json, shlex, sys

src, dest = sys.argv[1], sys.argv[2]
d = json.load(open(src))
with open(dest, "w") as f:
    f.write(f"export CLOUDFLARE_ACCOUNT_ID={shlex.quote(d['accountId'])}\n")
    f.write(f"export CLOUDFLARE_API_KEY={shlex.quote(d['apiKey'])}\n")
    f.write("export CLOUDFLARE_AUTH_TYPE=api_token\n")
    f.write("unset CLOUDFLARE_EMAIL\n")
    if d.get("accountName"):
        f.write(f"export CLOUDFLARE_ACCOUNT_NAME={shlex.quote(d['accountName'])}\n")
PY

chmod 600 "$HOME/.cloudflare/cerin.env"

echo "Wrote Cloudflare credentials to ~/.cloudflare/cerin.env"
echo "  account:   ${account_id}"
echo "  auth type: api_token"
