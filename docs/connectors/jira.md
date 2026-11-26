# Jira

Jira Cloud connections use Composio-managed OAuth2. Cerin stores the connected-account identifier, Composio user identifier, site, and Atlassian account identity, not an Atlassian access token, refresh token, or OAuth secret. The Composio API key remains on the backend and provider tokens never enter the agent sandbox.

## Server configuration

Set `CERIN_COMPOSIO_API_KEY` to a Composio project's API key. No Jira OAuth client ID or secret is configured in Cerin. The backend resolves the oldest Composio-managed `jira` auth config, creating one if none exists. Consent screens show Composio's managed app; white-labeling the hosted Connect Link page is a Composio dashboard setting.

A public HTTPS backend origin is required: `CERIN_PUBLIC_BACKEND_URL`, or a public `CERIN_BACKEND_URL`. Connect Link returns to `<origin>/jira-app/setup?state=…`, then opens `cerin://jira-callback`. The initiating administrator completes binding in Desktop with their authenticated session and a one-time code. Pending state expires after ten minutes and cannot be reused. Declined, cancelled, expired, or invalid authorization ends once without automatic retry or browser reopening.

Tests use local fixtures; no live Jira grant or human consent is created by them.

## Connecting and using a site

A team administrator chooses **Jira** in Add connector and authorizes through Composio. At setup, Cerin calls `accessible-resources` and `myself`. The grant must have exactly one accessible Jira site; multiple sites are rejected instead of choosing one implicitly. Reauthorize with one site selected if necessary.

The binding starts private to the authorizing member. Administrators can explicitly grant access to other members. An allowed member must select the Jira binding for the agent session. Jira project roles, issue permissions, and Atlassian site access still apply.

The built-in `jira` skill uses the session-scoped backend proxy. Every request is pinned to `https://api.atlassian.com` and must start `/ex/jira/<bound-cloudId>/`. Absolute URLs, host switching, traversal, and paths for another cloud ID are refused. GET, POST, PUT, and DELETE are available within that site boundary, subject to the grant and Jira permissions. Query parameters travel separately from the validated relative path. The skill supports bounded project/issue reads and requested issue creation, comments, and transitions using Atlassian Document Format where required.

This connector is for Jira Cloud through Atlassian's API, not a Jira Data Center hostname. Composio managed-app quotas and Atlassian rate limits are shared limits. Calls are not automatically retried, including writes. A 401, 403, or inactive account means **Jira needs to be reconnected**; a 429 is terminal rate limiting.

## Disconnect and failure cleanup

Disconnect first removes the Cerin binding with the access-check race guard, then makes a best-effort deletion of the saved Composio connection. Failed cleanup is logged and does not restore the binding; an administrator can remove the orphaned connection in Composio. A lost access-change race does not delete the connected account. Failed, expired, or declined pending authorization receives one best-effort cleanup attempt.

Deleting a Composio connection does not itself revoke the Atlassian grant. Revoke it in Atlassian account settings when required.

## References

- [Composio Jira toolkit](https://docs.composio.dev/toolkits/jira)
- [Composio connected accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Atlassian accessible resources](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
