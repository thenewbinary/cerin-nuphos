import { randomBytes } from 'node:crypto'

import { ComposioConnectorCallbackError, composioConnectLink } from '@/lib/composio-connect-core'
import { finishConnectorOAuth } from '@/lib/connector-oauth'
import { desktopCallbackResponse } from '@/lib/desktop-callback-page'
import { AppError } from '@/lib/errors'
import { parseObjectId } from '@/lib/objectid'
import { logError } from '@/lib/observability'
import { requestedBindingShare } from '@/lib/byos/initial-access'
import { publicBackendUrl } from '@/lib/claude-code-preview/runtime-backend-url'
import { composioUserId, deleteComposioAccount } from '@/lib/personal-credentials/composio'
import { composioConnectorPendingOAuth } from '@/models'

import type { ComposioConnectorSpec } from '@/lib/composio-connect-core'
import type { ConnectorBindPersist } from '@/lib/connector-oauth'
import type { TeamAuthVariables } from '@/middleware/auth/types'
import type { ComposioConnectorPendingOAuth } from '@/models'
import type { Context } from 'hono'

export const COMPOSIO_PENDING_TTL_MS = 10 * 60_000

/** POST /start-oauth: a hosted Connect Link and a one-time pending state. */
export async function startComposioConnectorOAuth(
  c: Context<{ Variables: TeamAuthVariables }>,
  spec: ComposioConnectorSpec,
  callbackPath: string,
): Promise<Response> {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const requesterUserId = c.get('userId')
  const state = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + COMPOSIO_PENDING_TTL_MS)
  const base = publicBackendUrl()

  if (!base?.startsWith('https://'))
    throw new AppError(
      503,
      `${spec.provider}_not_configured`,
      'A public HTTPS backend URL is required',
    )
  const callback = new URL(callbackPath, base)

  callback.searchParams.set('state', state)
  const link = await composioConnectLink(
    spec,
    composioUserId(teamId.toHexString(), requesterUserId),
    callback.href,
  )

  await composioConnectorPendingOAuth().insertOne({
    ...(await requestedBindingShare(c)),
    _id: state,
    provider: spec.provider,
    teamId,
    requesterUserId,
    composioAccountId: link.accountId,
    expiresAt,
  })

  return c.json({ state, authorizeUrl: link.authorizeUrl, expiresAt: expiresAt.toISOString() })
}

/** DELETE /start-oauth/:state — the desktop closed the dialog before approval. */
export async function cancelComposioConnectorOAuth(
  c: Context<{ Variables: TeamAuthVariables }>,
  spec: ComposioConnectorSpec,
): Promise<Response> {
  const pending = await composioConnectorPendingOAuth().findOneAndDelete({
    _id: c.req.param('state') ?? '',
    provider: spec.provider,
    teamId: parseObjectId(c.get('teamId'), 'teamId'),
    requesterUserId: c.get('userId'),
  })

  if (pending) await deleteComposioAccount(pending.composioAccountId)

  return c.body(null, 204)
}

/**
 * The callback's account id is never trusted: the pending record's account is
 * verified server-side, then the provider identity is fetched through the
 * proxy (which verifies again per call). Any failure, decline or expiry deletes
 * the pending Composio account once and ends in a single terminal error.
 */
export async function handleComposioConnectorCallback<B extends object>(
  c: Context,
  args: {
    spec: ComposioConnectorSpec
    deepLink: string
    identity: (pending: ComposioConnectorPendingOAuth, composioUserId: string) => Promise<B>
    persist: ConnectorBindPersist<B>
  },
): Promise<Response> {
  const { spec } = args
  const state = c.req.query('state') ?? ''
  const back = (params: Record<string, string>) =>
    desktopCallbackResponse(c, args.deepLink, { state, ...params })

  if (!/^[a-f0-9]{48}$/iu.test(state)) return back({ error: 'invalid_state' })
  const pending = await composioConnectorPendingOAuth().findOneAndDelete({
    _id: state,
    provider: spec.provider,
  })

  if (!pending) return back({ error: 'expired_state' })
  const fail = async (error: string, description?: string) => {
    await deleteComposioAccount(pending.composioAccountId).catch((cause: unknown) =>
      logError(`${spec.provider}.pending_connection_cleanup_failed`, cause),
    )

    return back(description === undefined ? { error } : { error, error_description: description })
  }

  if (pending.expiresAt.getTime() < Date.now()) return fail('expired_state')
  if (c.req.query('status') !== 'success') return fail('access_denied')
  try {
    const userId = composioUserId(pending.teamId.toHexString(), pending.requesterUserId)
    const draft = await args.identity(pending, userId)

    return back(
      await finishConnectorOAuth({
        provider: spec.oauthProvider ?? spec.provider,
        defer: true,
        state,
        teamId: pending.teamId,
        requesterUserId: pending.requesterUserId,
        share: pending.share,
        draft,
        persist: args.persist,
      }),
    )
  } catch (error) {
    if (error instanceof ComposioConnectorCallbackError) return fail(error.code, error.description)

    return fail(`${spec.provider}_connection_failed`)
  }
}
