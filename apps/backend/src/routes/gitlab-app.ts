import { Hono } from 'hono'

import { config } from '@/config'
import {
  getCurrentUser,
  GITLAB_CONNECTOR,
  GITLAB_HOST_URL,
  verifyWebhookToken,
} from '@/lib/byos/gitlab'
import {
  handleComposioConnectorCallback,
  persistComposioConnectorBinding,
} from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'

import type { BindingAccess, GitlabBinding } from '@/models'
import type { ObjectId } from 'mongodb'

export const gitlabAppRoutes = new Hono()

// The Electron deep-link target: same cerin:// scheme as the other connectors,
// a distinct hostname so the desktop can route by it.
gitlabAppRoutes.get('/setup', async (c) =>
  handleComposioConnectorCallback(c, {
    spec: GITLAB_CONNECTOR,
    deepLink: 'cerin://gitlab-callback',
    identity: async (pending, composioUserId) => {
      const user = await getCurrentUser({
        composioAccountId: pending.composioAccountId,
        composioUserId,
      })

      return {
        hostUrl: GITLAB_HOST_URL,
        accountId: user.id,
        username: user.username,
        displayName: user.name,
        avatarUrl: user.avatarUrl,
        composioAccountId: pending.composioAccountId,
        composioUserId,
      }
    },
    persist: persistGitlabBinding,
  }),
)

type GitlabBindingDraft = Omit<GitlabBinding, 'id' | 'label' | 'createdAt' | 'access'>

// Re-binding the same GitLab account replaces the existing binding's
// connection instead of accumulating duplicates. The original binding id is
// preserved so references stay valid.
export async function persistGitlabBinding(
  teamId: ObjectId,
  draft: GitlabBindingDraft,
  access: BindingAccess,
): Promise<Record<string, string>> {
  return persistComposioConnectorBinding<GitlabBinding>({
    spec: GITLAB_CONNECTOR,
    field: 'gitlabAccounts',
    teamId,
    draft,
    access,
    matches: (existing) => existing.accountId === draft.accountId,
    label: draft.username,
    result: { host_url: draft.hostUrl, username: draft.username },
  })
}

type GitlabWebhookPayload = {
  object_kind?: string
  event_name?: string
}

gitlabAppRoutes.post('/webhook', async (c) => {
  if (!config.byos.gitlab.webhookSecret) {
    throw new AppError(503, 'webhook_not_configured', 'GITLAB_WEBHOOK_SECRET is not set')
  }

  const headerToken = c.req.header('X-Gitlab-Token')

  if (!verifyWebhookToken(headerToken)) {
    throw new AppError(401, 'invalid_signature', 'GitLab webhook token verification failed')
  }

  const rawBody = await c.req.text()
  let payload: GitlabWebhookPayload

  try {
    payload = JSON.parse(rawBody) as GitlabWebhookPayload
  } catch {
    throw new AppError(400, 'invalid_payload', 'Webhook body is not valid JSON')
  }

  const kind = payload.object_kind ?? payload.event_name ?? 'unknown'
  const delivery = c.req.header('X-Gitlab-Event-UUID') ?? '?'

  // Today we only log events; the binding lifecycle is driven by the connect
  // flow + explicit unbind. This handler exists so operators can wire up a
  // System Hook without us 404'ing.
  console.log(`[gitlab-webhook] ${delivery} ${kind} acknowledged`)

  return c.body(null, 204)
})
