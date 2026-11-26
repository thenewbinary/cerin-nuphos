# Asana

Asana connections use Composio-managed OAuth2. Cerin stores the connected-account identifier, Composio user identifier, and Asana account identity, not an Asana access token, refresh token, or OAuth secret. The Composio API key remains on the backend and no provider token is handed to the agent.

## Server configuration

Set `CERIN_COMPOSIO_API_KEY` to a Composio project's API key. No Asana OAuth client ID or secret is configured in Cerin. The backend resolves the oldest Composio-managed `asana` auth config, creating one if none exists. Consent screens show Composio's managed app; white-labeling the hosted Connect Link page is a Composio dashboard setting.

The backend needs a public HTTPS origin from `CERIN_PUBLIC_BACKEND_URL`, or a public `CERIN_BACKEND_URL`. Connect Link returns to `<origin>/asana-app/setup?state=…`, then opens `cerin://asana-callback`. The initiating administrator completes binding in Desktop with their authenticated session and a one-time code. Pending state expires after ten minutes and is single-use. Failed, declined, cancelled, expired, or invalid authorization produces one terminal error and no automatic retry or browser reopening.

Fixture tests do not contact Composio or Asana and do not perform a person's production consent.

## Connecting and using an account

A team administrator chooses **Asana** in Add connector and authorizes through Composio. Setup reads `GET /users/me` and stores the returned account identity. A new binding starts with only the authorizing member in its allow-list. Administrators can change access in the connector's access editor; an allowed member must also select the binding for the agent session. Asana workspace, project, and task permissions remain authoritative.

The built-in `asana` skill calls the session-scoped backend proxy. Requests are pinned to `https://app.asana.com/api/1.0`; GET, POST, PUT, and DELETE are supported. Absolute URLs, traversal, query-bearing paths, and host switching are refused. Query parameters are sent separately. The skill documents bounded pagination, task/project reads, requested task creation, stories, and completion. Asana's consent grant and resource permissions still determine what can be accessed or changed.

Composio managed-app quotas and Asana rate limits are shared deployment limits. Requests, particularly writes, are never automatically retried. A 401, 403, or inactive account means **Asana needs to be reconnected**; a 429 is terminal rate limiting. A provider permission error is not a reason to repeat the write or search for a raw token.

## Disconnect and failure cleanup

Disconnect first removes the Cerin binding with the access-check race guard, then makes a best-effort deletion of the saved Composio connection. Failed cleanup is logged and does not restore the binding; an administrator can remove the orphaned connection in Composio. A lost access-change race does not delete the connected account. Pending authorization failure receives one best-effort cleanup attempt.

Deleting a Composio connection is separate from revoking the Asana grant. Revoke the application in Asana if that is also required.

## References

- [Composio Asana toolkit](https://docs.composio.dev/toolkits/asana)
- [Composio connected accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [Asana API](https://developers.asana.com/docs/overview)
