# Linear

Linear connections use Composio-managed OAuth2. Cerin stores the connected-account identifier, Composio user identifier, and Linear workspace identity, not a Linear access token, refresh token, or OAuth secret. The Composio API key remains on the backend. The agent receives no provider token.

## Server configuration

Set `CERIN_COMPOSIO_API_KEY` to a Composio project's API key. No Linear OAuth client ID or secret is configured in Cerin. The backend resolves the oldest Composio-managed `linear` auth config, creating one if none exists. Consent screens show Composio's managed app; white-labeling the hosted Connect Link page is a Composio dashboard setting, not a Cerin environment variable.

The backend needs a public HTTPS origin from `CERIN_PUBLIC_BACKEND_URL`, or a public `CERIN_BACKEND_URL`. Connect Link returns to `<origin>/linear-app/setup?state=…`, then opens `cerin://linear-callback`. Desktop completion requires the initiating administrator's authenticated session and one-time code. Pending state is single-use and expires after ten minutes. An expired, declined, cancelled, or invalid attempt produces one terminal error; the browser is not reopened and authorization is not retried automatically.

Fixture tests need neither a live Composio connection nor a Linear account. Production consent requires a person and is not performed by the tests.

## Connecting and using a workspace

A team administrator chooses **Linear** in Add connector and authorizes through Composio. Setup reads the viewer and organization through Linear GraphQL and saves that identity on the binding. A new binding starts with only the authorizing member in its allow-list. An administrator can change access in the connector's access editor; an allowed member must still select the binding for the agent session. Linear workspace, team, and user permissions continue to apply.

The built-in `linear` skill calls the session-scoped backend proxy, which checks selection, membership access, and the saved connected account before each request. It permits only `POST /graphql` at `https://api.linear.app`. It cannot switch hosts or submit a connected-account or Composio user identity. GraphQL reads, issue creation, comments, updates, and workflow-state changes use the provider's normal schema and permissions.

Composio managed-app quotas and Linear rate limits are shared deployment limits, not dedicated Cerin OAuth-app quotas. Pagination in helpers is bounded. Writes are never automatically retried. A 401, 403, or inactive account means **Linear needs to be reconnected**; a 429 is terminal rate limiting. Do not seek a token or repeat a write after these failures.

## Disconnect and failure cleanup

Disconnect first removes the Cerin binding with the access-check race guard, then makes a best-effort deletion of the saved Composio connection. A failed Composio cleanup is logged and does not restore the binding; an administrator can remove the orphaned connection in Composio. A disconnect that loses an access-change race does not delete the connected account. Pending authorization failures make one best-effort cleanup attempt.

Deleting a Composio connection is distinct from revoking the provider grant. Revoke access in Linear if that is also required. The provider grant and Cerin binding are separate authorization boundaries.

## References

- [Composio Linear toolkit](https://docs.composio.dev/toolkits/linear)
- [Composio connected accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [Linear GraphQL API](https://linear.app/developers/graphql)
