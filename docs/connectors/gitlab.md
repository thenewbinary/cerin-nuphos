# GitLab

GitLab connections use Composio-managed OAuth2. Cerin stores the connected-account identifier, Composio user identifier, and gitlab.com user identity, not a GitLab access token, refresh token, or OAuth secret. The Composio API key remains on the backend and the agent receives no raw token.

## Server configuration

Set `CERIN_COMPOSIO_API_KEY` to a Composio project's API key. No GitLab OAuth client ID or secret is configured in Cerin. The backend resolves the oldest Composio-managed `gitlab` auth config, creating one if none exists. Consent screens show Composio's managed app; white-labeling the hosted Connect Link page is a Composio dashboard setting.

The backend needs a public HTTPS origin from `CERIN_PUBLIC_BACKEND_URL`, or a public `CERIN_BACKEND_URL`. Connect Link returns to `<origin>/gitlab-app/setup?state=…`, then opens `cerin://gitlab-callback`. The initiating administrator completes binding in Desktop with their authenticated session and a one-time code. Pending state is single-use and expires after ten minutes. Declined, cancelled, expired, or invalid authorization produces one terminal error without automatic retry or browser reopening.

Tests are fixture-based and do not create a live GitLab grant or perform production consent.

## Connecting and using gitlab.com

A team administrator chooses **GitLab** in Add connector and authorizes through Composio. Setup reads `GET /user` and stores that identity. A new binding starts with only the authorizing member in its allow-list. Administrators can change that list in the access editor; an allowed member must still select the binding for the agent session. GitLab project, repository, merge-request, and CI permissions continue to apply.

The built-in `gitlab` skill calls the session-scoped backend proxy pinned to `https://gitlab.com/api/v4`. GET, POST, and PUT are supported for API operations such as reading repository files, projects, merge requests, and pipelines, and making requested merge-request changes or comments. Paths cannot switch hosts, contain traversal, or carry their own query string. Pagination must be bounded.

**Only gitlab.com is supported. Self-managed GitLab instances are not supported by Composio's managed app.** No raw token is exported for HTTPS `git clone`/`git push`, `glab`, or other token-authenticated CLI workflows. Those capabilities are intentionally dropped for this connector; use repository-file and merge-request APIs instead. Composio managed-app quotas and GitLab rate limits are shared deployment limits.

Requests are never automatically retried, particularly writes. A 401, 403, or inactive account means **GitLab needs to be reconnected**; a 429 is terminal rate limiting. Do not work around a denial with a token, alternate host, or repeated mutation.

## Disconnect and failure cleanup

Disconnect first removes the Cerin binding with the access-check race guard, then makes a best-effort deletion of the saved Composio connection. Failed cleanup is logged and does not restore the binding; an administrator can remove the orphaned connection in Composio. A lost access-change race does not delete the connected account. Failed or expired pending authorization receives one best-effort cleanup attempt.

Deleting a Composio connection is separate from revoking the GitLab grant. Revoke access in GitLab when required.

## References

- [Composio GitLab toolkit](https://docs.composio.dev/toolkits/gitlab)
- [Composio connected accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [GitLab REST API](https://docs.gitlab.com/api/rest/)
