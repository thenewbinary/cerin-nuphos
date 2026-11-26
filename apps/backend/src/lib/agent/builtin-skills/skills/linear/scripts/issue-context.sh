#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'usage: issue-context.sh CERIN_TEAM_ID BINDING_ID [SEARCH_ALIASES]\n' >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
python3 - "$script_dir/graphql.sh" "$1" "$2" "${3:-}" <<'PYTHON'
import json
import subprocess
import sys


def request(query, variables=None):
    result = subprocess.run(
        ["bash", sys.argv[1], sys.argv[2], sys.argv[3]],
        input=json.dumps({"query": query, "variables": variables or {}}),
        text=True,
        stdout=subprocess.PIPE,
    )
    if result.returncode:
        raise SystemExit(result.returncode)
    return json.loads(result.stdout)["data"]


def pages(query, path, variables=None):
    variables = dict(variables or {})
    nodes = []
    for _ in range(10):
        data = request(query, variables)
        for key in path:
            data = data[key]
        nodes.extend(data["nodes"])
        if not data["pageInfo"]["hasNextPage"]:
            return nodes
        variables["after"] = data["pageInfo"]["endCursor"]
    raise ValueError("Linear pagination exceeded 10 pages; narrow the search and try again")


page_info = "pageInfo { hasNextPage endCursor }"
teams_query = """query IssueContextTeams($after: String) {
  teams(first: 100, after: $after) {
    nodes { id key name } PAGE_INFO
  }
}""".replace("PAGE_INFO", page_info)
users_query = """query IssueContextUsers($after: String, $filter: UserFilter) {
  users(first: 100, after: $after, filter: $filter) {
    nodes { id name displayName email active } PAGE_INFO
  }
}""".replace("PAGE_INFO", page_info)
memberships_query = """query IssueContextMemberships($id: String!, $after: String) {
  user(id: $id) {
    teams(first: 100, after: $after) {
      nodes { id key name } PAGE_INFO
    }
  }
}""".replace("PAGE_INFO", page_info)

terms = list(dict.fromkeys(term.strip() for term in sys.argv[4].split("|") if term.strip()))
if len(terms) > 10:
    print("Use at most 10 search aliases per call.", file=sys.stderr)
    raise SystemExit(2)
user_filter = {"active": {"eq": True}}
if terms:
    user_filter["or"] = [
        {field: {"containsIgnoreCase": term}}
        for term in terms for field in ("name", "displayName", "email")
    ]

users = pages(users_query, ["users"], {"filter": user_filter})
matched = bool(users)
if not users and terms:
    users = pages(users_query, ["users"], {"filter": {"active": {"eq": True}}})

for user in users:
    user["teams"] = {"nodes": pages(
        memberships_query, ["user", "teams"], {"id": user["id"]},
    )} if terms and matched and len(users) == 1 else None

print(json.dumps({
    "viewer": request("query IssueContextViewer { viewer { id name } }")["viewer"],
    "teams": pages(teams_query, ["teams"]),
    "users": users,
    "userSearchMatched": matched,
}, ensure_ascii=False, indent=2))
PYTHON
