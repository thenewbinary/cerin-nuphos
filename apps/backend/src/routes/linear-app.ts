import { Hono } from 'hono'

import { config } from '@/config'
import { applyLinearIssueWebhook } from '@/lib/agent/linear-issue-webhook'
import { LINEAR_CONNECTOR, linearViewer, verifyWebhookSignature } from '@/lib/byos/linear'
import {
  handleComposioConnectorCallback,
  persistComposioConnectorBinding,
} from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'
import { logEvent } from '@/lib/observability'

import type { BindingAccess, LinearWorkspaceBinding } from '@/models'
import type { ObjectId } from 'mongodb'

export const linearAppRoutes = new Hono()

// The Electron deep-link target: same cerin:// scheme as the other connectors,
// a distinct hostname so the desktop can route by it.
linearAppRoutes.get('/setup', async (c) =>
  handleComposioConnectorCallback(c, {
    spec: LINEAR_CONNECTOR,
    deepLink: 'cerin://linear-callback',
    identity: async (pending, composioUserId) => {
      const viewer = await linearViewer({
        composioAccountId: pending.composioAccountId,
        composioUserId,
      })

      return {
        workspaceId: viewer.organization.id,
        workspaceName: viewer.organization.name,
        organizationUrlKey: viewer.organization.urlKey,
        accountId: viewer.user.id,
        accountName: viewer.user.name,
        composioAccountId: pending.composioAccountId,
        composioUserId,
      }
    },
    persist: persistLinearBinding,
  }),
)

type LinearBindingDraft = Omit<LinearWorkspaceBinding, 'id' | 'label' | 'createdAt' | 'access'>

// Re-binding the same workspace replaces the existing binding's connection
// instead of accumulating duplicates. The original binding id is preserved so
// references stay valid.
export async function persistLinearBinding(
  teamId: ObjectId,
  draft: LinearBindingDraft,
  access: BindingAccess,
): Promise<Record<string, string>> {
  return persistComposioConnectorBinding<LinearWorkspaceBinding>({
    spec: LINEAR_CONNECTOR,
    field: 'linearWorkspaces',
    teamId,
    draft,
    access,
    matches: (existing) => existing.workspaceId === draft.workspaceId,
    label: draft.workspaceName,
    result: { workspace_name: draft.workspaceName },
  })
}

type LinearWebhookPayload = {
  type?: string
  action?: string
  webhookTimestamp?: number
}

const LINEAR_MAX_SKEW_MS = 60_000

// Issue events refresh linked session tags; agent wakeups from Linear are not
// implemented, so every other event is only acknowledged.
linearAppRoutes.post('/webhook', async (c) => {
  if (!config.byos.linear.webhookSecret) {
    throw new AppError(503, 'webhook_not_configured', 'LINEAR_WEBHOOK_SECRET is not set')
  }

  const rawBody = new Uint8Array(await c.req.raw.arrayBuffer())
  const sig = c.req.header('Linear-Signature')

  if (!verifyWebhookSignature(rawBody, sig)) {
    throw new AppError(401, 'invalid_signature', 'Linear webhook signature verification failed')
  }

  let payload: LinearWebhookPayload

  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody)) as LinearWebhookPayload
  } catch {
    throw new AppError(400, 'invalid_payload', 'Webhook body is not valid JSON')
  }

  // Linear signs webhookTimestamp (ms) and recommends rejecting anything older
  // than a minute, so a captured request cannot be replayed later.
  const skew = Math.abs(Date.now() - Number(payload.webhookTimestamp))

  if (Number.isNaN(skew) || skew > LINEAR_MAX_SKEW_MS) {
    throw new AppError(
      401,
      'stale_webhook',
      'Linear webhook timestamp is outside the allowed window',
    )
  }
  await applyLinearIssueWebhook(payload)
  logEvent('info', 'linear.webhook.acknowledged', {
    type: payload.type ?? 'unknown',
    action: payload.action ?? 'unknown',
  })

  return c.body(null, 200)
})
