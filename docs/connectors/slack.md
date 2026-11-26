# Slack connector

The Slack connector uses Composio-managed OAuth2 so an agent can read Slack channels and threads and post messages through a connected Slack account. Cerin stores the connected-account identifier, Composio user identifier, and Slack workspace/user identity, not a Slack access token, refresh token, or OAuth secret. The Composio API key remains on the backend and no Slack token enters the agent sandbox.

**This is not two-way chat with Cerin from Slack.** It does not deliver Slack events to Cerin. Chatting with Cerin in Slack channels still requires Cerin's own native Slack app, separately configured with the `SLACK_*` messaging environment and inbound event delivery. Composio's managed Slack app cannot deliver those events to Cerin's app. The native Slack bot remains a distinct integration and is offered only when its native configuration is present.

## Server configuration

Set `CERIN_COMPOSIO_API_KEY` to a Composio project's API key for the agent-facing connector. No Slack OAuth client ID or secret is required for this connector. The backend resolves the oldest Composio-managed `slack` auth config, creating one if none exists. Consent screens show Composio's managed app; white-labeling the hosted Connect Link page is a Composio dashboard setting.

The backend needs a public HTTPS origin from `CERIN_PUBLIC_BACKEND_URL`, or a public `CERIN_BACKEND_URL`. Connect Link returns to `<origin>/slack-integration-app/setup?state=…`, then opens `cerin://slack-integration-callback`. The initiating administrator completes binding in Desktop with their authenticated session and a one-time code. Pending state is single-use and expires after ten minutes. Declined, cancelled, expired, or invalid authorization ends once without automatic retry or browser reopening.

Fixture tests do not create a live Slack grant, deliver events, or complete production consent. Native Slack bot configuration and event delivery are separate deployment work.

## Connecting and using a workspace

A team administrator chooses **Slack** in Add connector and authorizes through Composio. Setup calls `auth.test` and stores the Slack team and authorizing user identity. A new binding starts with only the authorizing member in its allow-list. Administrators can change access in the connector's access editor; an allowed member must also select the integration for the agent session. Slack channel membership and workspace permissions still apply.

The built-in `slack` skill uses the session-scoped backend proxy pinned to `https://slack.com/api`. Supported reads are `auth.test`, `conversations.list`, `conversations.info`, `conversations.history`, `conversations.replies`, `users.info`, and `users.list`. The only supported write is `POST /chat.postMessage`, for a requested channel message or thread reply. Other Slack API endpoints and methods are refused. Pagination cursors must be followed for a bounded number of requests.

Composio managed-app quotas and Slack workspace/rate limits are shared limits. Calls are never automatically retried. A 401, 403, inactive account, or Slack authentication error means **Slack needs to be reconnected**; a 429 or Slack `ratelimited` result is terminal. Slack can return HTTP 200 with `{"ok":false}`; that is a failed operation and must not cause a write to be replayed.

## Disconnect and failure cleanup

Disconnect first removes the Cerin binding with the access-check race guard, then makes a best-effort deletion of the saved Composio connection. Failed cleanup is logged and does not restore the binding; an administrator can remove the orphaned connection in Composio. A lost access-change race does not delete the connected account. Failed or expired pending authorization receives one best-effort cleanup attempt.

Deleting a Composio connection is separate from revoking the Slack grant. Revoke the app in Slack if required. This has no effect on a separately installed native Cerin Slack bot.

## References

- [Composio Slack toolkit](https://docs.composio.dev/toolkits/slack)
- [Composio connected accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [Slack Web API](https://docs.slack.dev/apis/web-api/)
- [Slack rate limits](https://docs.slack.dev/apis/web-api/rate-limits/)
