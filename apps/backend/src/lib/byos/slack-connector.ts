import { ComposioConnectorCallbackError, composioProxyExecute } from '@/lib/composio-connect'
import { AppError } from '@/lib/errors'

import type { ComposioConnectorSpec, ComposioProxySpec } from '@/lib/composio-connect'
import type { SlackIntegrationBinding } from '@/models'

export const SLACK_CONNECTOR: ComposioConnectorSpec = {
  provider: 'slack',
  displayName: 'Slack',
  toolkitSlug: 'slack',
  oauthProvider: 'slackIntegration',
}

const READ_PATHS = new Set([
  '/auth.test',
  '/conversations.list',
  '/conversations.info',
  '/conversations.history',
  '/conversations.replies',
  '/users.info',
  '/users.list',
])

export const SLACK_PROXY: ComposioProxySpec = {
  ...SLACK_CONNECTOR,
  baseUrl: 'https://slack.com/api',
  methods: ['GET', 'POST'],
  allowPath: (path, method) =>
    READ_PATHS.has(path) || (method === 'POST' && path === '/chat.postMessage'),
}

export type SlackConnection = Pick<SlackIntegrationBinding, 'composioAccountId' | 'composioUserId'>

export async function slackProxy(
  connection: SlackConnection,
  args: { method: string; path: string; body?: unknown; query?: Record<string, string> },
): Promise<{ status: number; data: unknown }> {
  const result = await composioProxyExecute(SLACK_PROXY, {
    accountId: connection.composioAccountId,
    userId: connection.composioUserId,
    ...args,
  })
  const payload = result.data as { ok?: unknown; error?: unknown } | null

  if (payload?.ok !== false) return result
  const error = typeof payload.error === 'string' ? payload.error : ''

  if (['account_inactive', 'invalid_auth', 'not_authed', 'token_revoked'].includes(error)) {
    throw new AppError(403, 'slack_reconnect_required', 'Slack needs to be reconnected')
  }
  if (error === 'ratelimited') {
    throw new AppError(429, 'slack_rate_limited', 'Slack rate limited this request. Do not retry.')
  }
  const detail = /^[a-z0-9_:.-]{1,64}$/u.test(error) ? `: ${error}` : ''

  throw new AppError(400, 'slack_api_error', `Slack API request failed${detail}`)
}

export async function slackIdentity(connection: SlackConnection): Promise<{
  slackTeamId: string
  slackTeamName: string
  slackUserId: string
  slackUserName: string | null
}> {
  const { data } = await slackProxy(connection, { method: 'POST', path: '/auth.test', body: {} })
  const identity = data as {
    ok?: unknown
    team_id?: unknown
    team?: unknown
    user_id?: unknown
    user?: unknown
    error?: unknown
  } | null

  if (
    identity?.ok !== true ||
    typeof identity.team_id !== 'string' ||
    !identity.team_id ||
    typeof identity.user_id !== 'string' ||
    !identity.user_id
  ) {
    const detail = typeof identity?.error === 'string' ? `: ${identity.error}` : ''

    throw new ComposioConnectorCallbackError(
      'slack_identity_failed',
      `Slack auth.test failed${detail}`,
    )
  }

  return {
    slackTeamId: identity.team_id,
    slackTeamName:
      typeof identity.team === 'string' && identity.team ? identity.team : identity.team_id,
    slackUserId: identity.user_id,
    slackUserName: typeof identity.user === 'string' && identity.user ? identity.user : null,
  }
}
