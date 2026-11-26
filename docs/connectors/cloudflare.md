# Cloudflare

Cloudflare uses Composio's hosted Connect Link with a **custom API_KEY auth config**, not OAuth and not a Composio-managed Cloudflare app. The user enters a Cloudflare API token directly on Composio's hosted page. Cerin stores the connected-account identifier, Composio user identifier, and Cloudflare account identity, not the API token or a global API key. The agent receives no provider credential.

## Server configuration

Set `CERIN_COMPOSIO_API_KEY` to a Composio project's API key. No Cloudflare OAuth client ID, secret, or static Cloudflare token is configured in Cerin. The backend resolves the oldest non-managed `cloudflare` auth config with the `API_KEY` scheme, filtering out OAuth configs. It creates a `use_custom_auth` config with empty credentials when none exists; the member supplies the token on the hosted page. White-labeling that page is a Composio dashboard setting.

A public HTTPS backend origin is required: `CERIN_PUBLIC_BACKEND_URL`, or a public `CERIN_BACKEND_URL`. Connect Link returns to `<origin>/cloudflare-app/setup?state=…`, then opens `cerin://cloudflare-callback`. The initiating administrator completes binding in Desktop with their authenticated session and a one-time code. Pending state is single-use and expires after ten minutes. Declined, cancelled, expired, or invalid authorization ends once without automatic retry or browser reopening.

Tests use fixtures and never require a real Cloudflare token, live Composio connection, or production consent.

## Connecting and using an account

A team administrator chooses **Cloudflare** in Add connector. On Composio's hosted Connect Link page, they enter an **account-scoped API token** with only the permissions Cerin needs. Setup calls `GET /accounts`; the token must have access to exactly one Cloudflare account. Zero or multiple accessible accounts are rejected rather than binding an ambiguous identity. Scope the token to one account and required resources such as DNS, Workers, R2, Pages, D1, or KV. Cerin no longer has an OAuth scope picker.

The binding starts private to the authorizing member. An administrator can explicitly change its allow-list; an allowed member must select the binding for the agent session. Cloudflare account and token permissions still apply.

The built-in `cloudflare` skill and existing DNS views call backend-scoped Composio proxy routes pinned to `https://api.cloudflare.com/client/v4`. GET, POST, PUT, PATCH, and DELETE are supported within the Cloudflare token's permissions. Paths cannot switch hosts, contain traversal, or carry their own query string. Server-side raw responses are preserved where needed; pagination is capped at 100 requests. DNS changes and other mutations are never automatically retried.

**No raw Cloudflare token is exported.** `wrangler` authentication and other raw-token CLI workflows are unavailable. Composio and Cloudflare rate limits apply. A 401, 403, or inactive account means **Cloudflare needs to be reconnected**; a 429 is terminal rate limiting. A `success:false` response is a failed operation, not a reason to retry a write.

## Disconnect and failure cleanup

Disconnect first removes the Cerin binding with the access-check race guard, then makes a best-effort deletion of the saved Composio connection. Failed cleanup is logged and does not restore the binding; an administrator can remove the orphaned connection in Composio. A lost access-change race does not delete the connected account. Failed or expired pending authorization receives one best-effort cleanup attempt.

Deleting a Composio connection does not revoke the API token in Cloudflare. Revoke it in Cloudflare's API-token settings when required.

## References

- [Composio Cloudflare toolkit](https://docs.composio.dev/toolkits/cloudflare)
- [Composio connected accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [Cloudflare API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare API v4](https://developers.cloudflare.com/api/)
