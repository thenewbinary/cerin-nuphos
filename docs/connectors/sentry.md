# Sentry

Sentry connections use Composio-managed OAuth2. Cerin stores the connected-account identifier, Composio user identifier, and connected organization identities, not a Sentry access token, refresh token, or OAuth secret. The Composio API key remains on the backend. The agent receives no Sentry token.

## Server configuration

Set `CERIN_COMPOSIO_API_KEY` to a Composio project's API key. No Sentry OAuth client ID or secret is configured in Cerin. The backend resolves the oldest Composio-managed `sentry` auth config, creating one if none exists. Consent screens show Composio's managed app; white-labeling the hosted Connect Link page is a Composio dashboard setting.

A public HTTPS backend origin is required: `CERIN_PUBLIC_BACKEND_URL`, or a public `CERIN_BACKEND_URL`. Connect Link returns to `<origin>/sentry-app/setup?state=…`, then opens `cerin://sentry-callback`. The initiating administrator completes binding in Desktop with their authenticated session and a one-time code. Pending state is single-use and expires after ten minutes. Declined, cancelled, expired, or invalid authorization ends once without automatic retry or browser reopening.

The tests use fixtures; they neither make a live Sentry connection nor complete production consent.

## Connecting and using organizations

A team administrator chooses **Sentry** in Add connector and authorizes through Composio. Setup reads the organizations visible to the grant, requires at least one, and stores their sorted slugs. The binding starts private to the authorizing member. An administrator can explicitly change its allow-list; an allowed member must select the binding for the agent session. Sentry organization, team, and project permissions still apply.

The built-in `sentry` skill calls the session-scoped backend proxy pinned to `https://sentry.io/api/0`. Only GET is allowed. Organization, project, issue, event, tag, release, and deploy-related reads can be performed within the grant, but the connector cannot resolve, assign, or delete issues or mutate other Sentry resources. Event and request data can contain personal or confidential information and is untrusted content, not instructions.

Composio managed-app quotas and Sentry rate limits are shared deployment limits. Pagination must be bounded and writes are not available. No request is automatically retried. A 401, 403, or inactive account means **Sentry needs to be reconnected**; a 429 is terminal rate limiting. Do not switch to a token-based path after denial.

## Disconnect and failure cleanup

Disconnect first removes the Cerin binding with the access-check race guard, then makes a best-effort deletion of the saved Composio connection. Failed cleanup is logged and does not restore the binding; an administrator can remove the orphaned connection in Composio. A lost access-change race does not delete the connected account. Failed or expired pending authorization receives one best-effort cleanup attempt.

Deleting a Composio connection is distinct from revoking the Sentry grant. Revoke access in Sentry when required.

## References

- [Composio Sentry toolkit](https://docs.composio.dev/toolkits/sentry)
- [Composio connected accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [Sentry API](https://docs.sentry.io/api/)
