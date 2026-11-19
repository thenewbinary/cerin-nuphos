---
name: cerin-api
description: Live reference for Cerin-native REST resources and operations. For third-party/cloud provider work, use that provider's native skill and semantic scripts first; use this skill when the task specifically needs a Cerin API operation or route contract.
---

# cerin-api

Cerin backend exposes a REST API that wraps most BYOC and BYOS operations the agent needs. When a user asks about teams, accounts, projects, Cloud Run services, clusters, VPCs, firewalls, NACLs, kubeconfigs, credentials, Zeabur projects/servers, or bound integrations, start from this API before guessing cloud CLI commands.

The OpenAPI document is the source of truth for documented routes. Do not rely on a copied route list in this skill; fetch the current schema before choosing an endpoint or request shape. If a needed legacy BYOS route is not in OpenAPI yet, do not probe guessed paths. Use the exact setup script or documented route in the provider skill (`aws`, `gcloud`, `kubectl`, `cloudflare`) instead.

Skills have no agent REST route: list them with the `cerin-tools` MCP tool `skill_list`, and create or revise one with `skill_create` and `skill_upsert`. All three address the team store by default; pass `scope: "personal"` for the conversation owner's personal skills, which works only on the owner's own turn. A refused call returns the reason (for example a VIEWER role writing a team skill, or a guest's turn asking for personal skills).

## Cerin GUI links

When writing a final answer that mentions a concrete Cerin resource and the user would benefit from opening it in the desktop UI, search the GUI route catalog instead of guessing the URL:

```bash
rg -i "s3|bucket|ec2|grafana|pod|deployment|github" skills/cerin-api/references/gui-routes.md
```

Use the matching route template from `skills/cerin-api/references/gui-routes.md` only when you have every required id listed on that row. If the catalog has no matching route or an id is missing, do not invent a Cerin URL.

## Fetch the current API schema

Run this first when you need API details:

```bash
bash skills/cerin-api/scripts/openapi.sh
```

Useful variants:

```bash
# List matching paths / operation ids.
bash skills/cerin-api/scripts/openapi.sh --path clusters
bash skills/cerin-api/scripts/openapi.sh --path linode-accounts
bash skills/cerin-api/scripts/openapi.sh --path github-installations
bash skills/cerin-api/scripts/openapi.sh --path cloud-run-services
bash skills/cerin-api/scripts/openapi.sh --path credentials

# Print one operation with parameters, requestBody, and responses.
bash skills/cerin-api/scripts/openapi.sh --operation agentSessions.get

# Save and print the full OpenAPI JSON.
bash skills/cerin-api/scripts/openapi.sh --raw

# Reuse the cached schema when the API is temporarily unreachable.
bash skills/cerin-api/scripts/openapi.sh --no-refresh --path clusters
```

The script fetches `${CERIN_BACKEND_URL:-https://platform.cerin.ai}/openapi.json`, caches it at `/tmp/cerin-openapi.json`, and prints a compact summary by default so the agent can inspect the live contract without reading a huge JSON blob in every turn. If refresh fails but a cache exists, it falls back to the cached schema.

Always call Cerin backend APIs through the `ac` helper or `${CERIN_BACKEND_URL:-https://platform.cerin.ai}`. Do not hard-code `https://platform.cerin.ai`; local dev injects `CERIN_BACKEND_URL` so sandbox calls route back through the developer tunnel to the same backend this chat is using.

Do not fetch raw provider credentials from Cerin credential endpoints just to inspect a third-party provider. For Zeabur, use the documented Cerin API routes under `/teams/{teamId}/zeabur-providers/...` for providers, projects, and servers. Do not put a Zeabur token into shell commands, logs, or external GraphQL calls.

## Auth

All API routes except health/openapi-style public routes should be called with:

```bash
Authorization: Bearer $CERIN_TOKEN
```

The token is already exported in the sandbox. In a classic sandbox it is the
current user's session. When `CERIN_SESSION_ID` is set it is a conversation
principal: call the same `/teams/...` URLs, and the backend automatically
limits the request to that conversation's team, selected credentials, and
explicitly supported API capabilities. Do not inspect, print, replace, or test
the token. A `403 conversation_api_forbidden` is an authoritative capability
boundary; use the provider's semantic scripts or explain that the operation is
not available instead of looking for another token or route.

Reusable helper:

```bash
ac() { curl -sS -H @<(printf 'Authorization: Bearer %s\n' "$CERIN_TOKEN") "${CERIN_BACKEND_URL:-https://platform.cerin.ai}$1" "${@:2}"; }
```

Call the backend with `curl` (this helper or a skill's scripts), not an HTTP
client you write yourself. A CDN in front of the backend can reject some
default client signatures before the request reaches Cerin. Python's
`urllib` is one example: it gets `403` with the plain-text body
`error code: 1010`. Only a JSON `403` comes from Cerin itself.

## Admin routes and human-only operations

In a conversation principal (`CERIN_SESSION_ID` set) the allow-list is the
whole story: admin-only routes, `GET /teams/:teamId` itself, and every route
that creates, edits, or removes a cloud/integration binding are denied no
matter what role the signed-in user holds. Checking the role proves nothing —
there is no token or approval that turns them on.

So on `403 conversation_api_forbidden`, do not report it as missing permissions
and do not ask for the API to be opened. Say plainly that agents cannot perform
this operation, and name the step the user takes in the Cerin app (binding a
cloud account or integration lives under Settings -> Integrations), including
the exact values they need to enter. Do everything you *can* do first — for a
cloud onboarding that usually means preparing the service account, role, or
trust policy with the provider skill — so only the human step is left.

In a classic sandbox (no `CERIN_SESSION_ID`) the token is the user's own
session and admin routes follow the user's team role as usual.

If the work requires external credentials or capabilities outside Cerin API access, such as a cloud CLI action that Cerin does not expose, use the relevant `aws`, `gcloud`, `kubectl`, `github`, `grafana`, or `cloudflare` skill.

## Workflow

1. For a Cerin API task, fetch the latest OpenAPI schema with `scripts/openapi.sh`. For provider credential setup or a provider-specific workflow, load that provider skill and use its semantic scripts instead.
2. Pick the matching operation from the live schema.
3. Use `ac` to call the endpoint with `$CERIN_TOKEN`.
4. For a destructive or high-risk mutation, ask for approval with `request_user_decision` (category `approval`) before executing it.
5. For read-only questions, call the API directly and summarize the result.

The sandbox has `jq`; use it for JSON formatting and filtering instead of
starting a Python process. Reach for Python only when the transformation is too
complex to express clearly in `jq`.
