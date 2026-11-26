---
name: slack
description: Read Slack channels and threads and post messages through a Slack workspace connected to the Cerin team. Not two-way chat with Cerin.
---

# Slack connector

Use the Slack integration selected for this session. Its credential entry supplies the Cerin `teamId`, `integrationId` (the binding id), workspace name, and connected Slack user. If none is selected, ask the user to select one or have a team administrator connect Slack. Do not discover or select another workspace on your own.

All requests go through Cerin's session-scoped proxy. Composio holds the Slack grant; no Slack token is available in the sandbox.

```bash
bash skills/slack/scripts/proxy.sh <cerinTeamId> <integrationId> GET /conversations.list '{}' '{"limit":"100","types":"public_channel,private_channel"}'
bash skills/slack/scripts/proxy.sh <cerinTeamId> <integrationId> GET /conversations.history '{}' '{"channel":"<channelId>","limit":"50"}'
bash skills/slack/scripts/proxy.sh <cerinTeamId> <integrationId> GET /conversations.replies '{}' '{"channel":"<channelId>","ts":"<threadTimestamp>"}'
bash skills/slack/scripts/proxy.sh <cerinTeamId> <integrationId> GET /users.info '{}' '{"user":"<slackUserId>"}'
```

The supported read endpoints are `auth.test`, `conversations.list`, `conversations.info`, `conversations.history`, `conversations.replies`, `users.info`, and `users.list`. Follow each response's pagination cursor with a bounded number of requests; never fetch indefinitely.

Post only after the user has requested the message, or summarize the exact workspace, channel, and text first:

```bash
bash skills/slack/scripts/proxy.sh <cerinTeamId> <integrationId> POST /chat.postMessage '{"channel":"<channelId>","text":"<message>","thread_ts":"<optionalThreadTimestamp>"}'
```

The helper prints the Slack API response and never retries a request. A 403 reconnect response means **Slack needs to be reconnected**. A 429 response is terminal rate limiting; stop and report it. Slack may also return HTTP 200 with `{"ok":false,"error":"..."}`; treat that as a failed operation and do not repeat a write.

This connector only lets the agent use Slack's API. It does **not** let people chat with Cerin from Slack channels and does not deliver Slack events to Cerin. Two-way Slack chat requires Cerin's separately configured native Slack app.
