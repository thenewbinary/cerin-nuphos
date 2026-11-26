import { Hono } from 'hono'

import { registerBindingAccessRoutes } from '@/lib/byos/access-routes'
import { SENTRY_CONNECTOR } from '@/lib/byos/sentry'
import {
  cancelComposioConnectorOAuth,
  deleteComposioAccountBestEffort,
  startComposioConnectorOAuth,
} from '@/lib/composio-connect'
import { parseObjectId } from '@/lib/objectid'
import {
  disconnectBinding,
  requireCanDisconnect,
  requireSentryAccount,
  requireTeamRole,
} from '@/middleware/auth'
import { teamByosBindings } from '@/models'

import type { TeamAuthVariables, SentryAccountVariables } from '@/middleware/auth'
import type { SentryAccountBinding } from '@/models'

export const sentryAccountsRoutes = new Hono<{ Variables: TeamAuthVariables }>()

export function publicView(b: SentryAccountBinding) {
  return {
    id: b.id.toHexString(),
    label: b.label,
    organizationSlugs: b.organizationSlugs,
    organizationName: b.organizationName,
    createdAt: b.createdAt,
  }
}

sentryAccountsRoutes.get('/', async (c) => {
  const teamId = parseObjectId(c.get('teamId'), 'teamId')
  const doc = await teamByosBindings().findOne(
    { _id: teamId },
    { projection: { sentryAccounts: 1 } },
  )

  return c.json({
    accounts: (doc?.sentryAccounts ?? []).map(publicView),
  })
})

// A Composio Connect Link: the member approves Composio's managed Sentry app
// on the hosted page; no SENTRY_OAUTH_* app is needed on this server.
sentryAccountsRoutes.post('/start-oauth', requireTeamRole('ADMINISTRATOR'), async (c) =>
  startComposioConnectorOAuth(c, SENTRY_CONNECTOR, '/sentry-app/setup'),
)

sentryAccountsRoutes.delete('/start-oauth/:state', requireTeamRole('ADMINISTRATOR'), async (c) =>
  cancelComposioConnectorOAuth(c, SENTRY_CONNECTOR),
)

const bindingScoped = new Hono<{ Variables: SentryAccountVariables }>()

bindingScoped.use('*', requireSentryAccount())
registerBindingAccessRoutes(bindingScoped, 'sentryAccounts', (c) => c.get('sentryBinding'))

bindingScoped.get('/', (c) => {
  return c.json(publicView(c.get('sentryBinding')))
})

bindingScoped.delete(
  '/',
  requireTeamRole('ADMINISTRATOR'),
  requireCanDisconnect('sentryAccess'),
  async (c) => {
    const teamId = parseObjectId(c.get('teamId'), 'teamId')
    const binding = c.get('sentryBinding')

    await disconnectBinding(c, teamId, 'sentryAccounts', { id: binding.id })
    // After the guarded pull, best effort: the binding is already gone, and a
    // failure only leaves an unreferenced Composio account.
    await deleteComposioAccountBestEffort('sentry', binding.composioAccountId)

    return c.body(null, 204)
  },
)

sentryAccountsRoutes.route('/:bindingId', bindingScoped)
